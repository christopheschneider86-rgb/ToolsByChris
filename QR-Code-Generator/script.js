'use strict';

// ─────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────
const S = {
    type:          'url',
    colorFg:       '#000000',
    colorFg2:      '#ec4899',
    useGradient:   false,
    gradientDir:   'diag',
    colorEyeOuter: '#000000',
    colorEyeInner: '#000000',
    colorBg:       '#ffffff',
    colorFrame:    '#6366f1',
    transparentBg: false,
    dotStyle:      'square',
    eyeOuterStyle: 'square',
    eyeInnerStyle: 'square',
    frameStyle:    'none',
    frameLabel:    'SCAN ME!',
    frameFont:     'Inter, sans-serif',
    colorLabelText:'#ffffff',
    logoDataUrl:   null,
    logoSize:      20,
    logoBgShape:   'rounded',
    colorLogoBg:   '#ffffff',
    ecLevel:       'M',
    dlSize:        512,
    matrix:        null,
    genId:         0,
};

const TYPE_LABELS = {
    url:'Website URL', text:'Text', email:'E-Mail', sms:'SMS', phone:'Telefon',
    wifi:'Wi-Fi', vcard:'vCard / Kontakt', event:'Event / Kalender',
    location:'Standort', pdf:'PDF-Link', social:'Social Media', app:'App-Download',
};

// ─────────────────────────────────────────────────────────────
//  BOOT
// ─────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
    if (typeof QRCode === 'undefined') {
        document.querySelectorAll('.preview-placeholder p').forEach(p => {
            p.textContent = '⚠ QR-Bibliothek nicht geladen.';
        });
        console.error('QRCode library missing.');
        return;
    }

    setupTypes();
    setupInputs();
    setupDesignToggle();
    setupColors();
    setupStyles();
    setupLogo();
    setupDownload();
    setupCopy();
    setupReset();

    generate();
    buildHeroQR();
});

// ─────────────────────────────────────────────────────────────
//  TYPE PICKER & INPUTS
// ─────────────────────────────────────────────────────────────
function setupTypes() {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            S.type = btn.dataset.type;
            document.getElementById('currentTypeLabel').textContent = TYPE_LABELS[S.type];
            document.querySelectorAll('.form-block').forEach(f => f.classList.remove('active'));
            document.getElementById('form-' + S.type)?.classList.add('active');
            generate();
        });
    });
}

function setupInputs() {
    document.querySelectorAll('.forms input, .forms textarea, .forms select').forEach(el => {
        el.addEventListener('input',  debounce(generate, 300));
        el.addEventListener('change', debounce(generate, 100));
    });

    const sp = document.getElementById('f-social-plat');
    const su = document.getElementById('f-social-user');
    const sv = document.getElementById('f-social-url');
    if (sp && su && sv) {
        const upd = () => {
            const u = su.value.trim().replace(/^@/, '');
            sv.value = u ? sp.value + u : '';
            generate();
        };
        sp.addEventListener('change', upd);
        su.addEventListener('input', debounce(upd, 300));
    }
}

// ─────────────────────────────────────────────────────────────
//  BUILD QR DATA
// ─────────────────────────────────────────────────────────────
function buildData() {
    const v  = id => (document.getElementById(id)?.value ?? '').trim();
    const vc = id =>  document.getElementById(id)?.checked ?? false;

    switch (S.type) {
        case 'url':   return v('f-url') || 'https://qrcraft.io';
        case 'text':  return v('f-text');
        case 'phone': return v('f-phone') ? 'tel:' + v('f-phone').replace(/\s/g, '') : '';

        case 'email': {
            const to = v('f-email-to'); if (!to) return '';
            return `mailto:${to}?subject=${encodeURIComponent(v('f-email-sub'))}&body=${encodeURIComponent(v('f-email-body'))}`;
        }
        case 'sms': {
            const num = v('f-sms-num').replace(/\s/g,''); if (!num) return '';
            return `smsto:${num}:${v('f-sms-msg')}`;
        }
        case 'wifi': {
            const ssid = v('f-wifi-ssid'); if (!ssid) return '';
            return `WIFI:T:${v('f-wifi-enc')||'WPA'};S:${we(ssid)};P:${we(v('f-wifi-pw'))};H:${vc('f-wifi-hidden')?'true':'false'};;`;
        }
        case 'vcard': {
            const fn = v('f-vc-fn'), ln = v('f-vc-ln'); if (!fn && !ln) return '';
            let c = `BEGIN:VCARD\nVERSION:3.0\nN:${ln};${fn};;;\nFN:${fn} ${ln}`;
            if (v('f-vc-org'))   c += '\nORG:'   + v('f-vc-org');
            if (v('f-vc-title')) c += '\nTITLE:' + v('f-vc-title');
            if (v('f-vc-phone')) c += '\nTEL;TYPE=CELL:' + v('f-vc-phone');
            if (v('f-vc-email')) c += '\nEMAIL:' + v('f-vc-email');
            if (v('f-vc-url'))   c += '\nURL:'   + v('f-vc-url');
            if (v('f-vc-addr'))  c += '\nADR:;;' + v('f-vc-addr') + ';;;;';
            return c + '\nEND:VCARD';
        }
        case 'event': {
            const t = v('f-ev-title'); if (!t) return '';
            let c = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${t}`;
            if (v('f-ev-loc'))   c += '\nLOCATION:'    + v('f-ev-loc');
            if (v('f-ev-start')) c += '\nDTSTART:'     + ical(v('f-ev-start'));
            if (v('f-ev-end'))   c += '\nDTEND:'       + ical(v('f-ev-end'));
            if (v('f-ev-desc'))  c += '\nDESCRIPTION:' + v('f-ev-desc');
            return c + '\nEND:VEVENT\nEND:VCALENDAR';
        }
        case 'location': {
            const lat = v('f-lat'), lng = v('f-lng');
            return lat && lng ? `geo:${lat},${lng}` : '';
        }
        case 'pdf':    return v('f-pdf');
        case 'social': {
            const plat = document.getElementById('f-social-plat')?.value ?? '';
            const user = v('f-social-user').replace(/^@/,'');
            return user ? plat + user : '';
        }
        case 'app':    return v('f-app-ios') || v('f-app-and');
        default:       return '';
    }
}

// ─────────────────────────────────────────────────────────────
//  GENERATE
// ─────────────────────────────────────────────────────────────
function generate() {
    const data = buildData();
    S.qrData = data;

    if (!data) {
        showQR(false);
        document.getElementById('qrInfo').style.display    = 'none';
        document.getElementById('dlSection').style.display = 'none';
        return;
    }

    let qr;
    try {
        qr = QRCode.create(data, { errorCorrectionLevel: S.ecLevel });
    } catch(e) {
        try { qr = QRCode.create(data, { errorCorrectionLevel: 'L' }); }
        catch(e2) { showQR(false); return; }
    }

    const { size, data: raw } = qr.modules;
    const mat = [];
    for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) row.push(raw[r * size + c] !== 0);
        mat.push(row);
    }
    S.matrix = mat;

    drawQR(document.getElementById('qrCanvas'), mat, 260);
    showQR(true);

    document.getElementById('qrInfo').style.display    = 'block';
    document.getElementById('infoType').textContent    = TYPE_LABELS[S.type] || S.type;
    document.getElementById('infoEc').textContent      = S.ecLevel;
    document.getElementById('infoLen').textContent     = data.length + ' Zeichen';
    document.getElementById('dlSection').style.display = 'block';
}

function showQR(show) {
    document.getElementById('qrCanvas').style.display           = show ? 'block' : 'none';
    document.getElementById('previewPlaceholder').style.display = show ? 'none'  : 'flex';
}

// ─────────────────────────────────────────────────────────────
//  CANVAS RENDERER
// ─────────────────────────────────────────────────────────────
function drawQR(canvas, mat, px, callbackAfterLogo) {
    if (!canvas || !mat) return;

    const myId = ++S.genId;

    const n        = mat.length;
    const hasLabel = S.frameStyle === 'badge';
    const hasBdr   = S.frameStyle !== 'none';
    const pad      = hasBdr ? Math.round(px * 0.06) : 0;
    const labelH   = hasLabel  ? Math.round(px * 0.14) : 0;
    const totalH   = px + labelH;

    canvas.width  = px;
    canvas.height = totalH;

    const ctx  = canvas.getContext('2d');
    const area = px - pad * 2;
    const cs   = area / n;
    const ox   = pad, oy = pad;

    // Background
    ctx.clearRect(0, 0, px, totalH);
    if (!S.transparentBg) {
        ctx.fillStyle = S.colorBg;
        ctx.fillRect(0, 0, px, totalH);
    }

    // Frame border
    if (hasBdr) {
        ctx.strokeStyle = S.colorFrame;
        ctx.lineWidth   = Math.max(2, pad * 0.6);
        const br = S.frameStyle === 'rounded' || S.frameStyle === 'badge' ? 12 : 4;
        ctx.beginPath();
        rrect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2,
              px - ctx.lineWidth, px - ctx.lineWidth, br);
        ctx.stroke();
    }

    // Data dots with Gradient support
    if (S.useGradient) {
        let gX1 = ox, gY1 = oy, gX2 = ox + area, gY2 = oy + area;
        if (S.gradientDir === 'horiz') { gY2 = oy; }
        else if (S.gradientDir === 'vert') { gX2 = ox; }
        let grad = ctx.createLinearGradient(gX1, gY1, gX2, gY2);
        grad.addColorStop(0, S.colorFg);
        grad.addColorStop(1, S.colorFg2 || '#ec4899');
        ctx.fillStyle = grad;
    } else {
        ctx.fillStyle = S.colorFg;
    }

    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (!mat[r][c])        continue;
            if (isFinder(r, c, n)) continue;
            ctx.beginPath();
            dot(ctx, ox + c * cs, oy + r * cs, cs, S.dotStyle);
            ctx.fill();
        }
    }

    // 3 Finder eyes (Outer + Inner separate)
    [[0, 0], [0, n - 7], [n - 7, 0]].forEach(([r, c]) => {
        eye(ctx, ox + c * cs, oy + r * cs, cs * 7, S.eyeOuterStyle, S.eyeInnerStyle, S.colorEyeOuter, S.colorEyeInner, S.colorBg, S.transparentBg);
    });

    // Badge label & completed frame bar
    if (hasLabel) {
        ctx.fillStyle = S.colorFrame;
        ctx.fillRect(0, px, px, labelH);
        ctx.fillStyle    = S.colorLabelText || '#ffffff';
        ctx.font         = `bold ${Math.round(labelH * 0.42)}px ${S.frameFont || 'Inter, sans-serif'}`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(S.frameLabel || 'SCAN ME!', px / 2, px + labelH / 2);
    }

    // Logo overlay (with aspect ratio preservation & custom quiet zone shape)
    if (S.logoDataUrl) {
        const img = new Image();
        img.onload = () => {
            if (myId !== S.genId || !S.logoDataUrl) return;

            const ls   = area * (S.logoSize / 100);
            const lx   = ox + (area - ls) / 2;
            const ly   = oy + (area - ls) / 2;
            const padL = ls * 0.1;
            const bw   = ls + padL * 2;
            const bh   = ls + padL * 2;
            const bx   = lx - padL;
            const by   = ly - padL;

            if (S.logoBgShape !== 'none') {
                ctx.beginPath();
                if (S.logoBgShape === 'circle') {
                    ctx.arc(lx + ls / 2, ly + ls / 2, bw / 2, 0, Math.PI * 2);
                } else if (S.logoBgShape === 'square') {
                    ctx.rect(bx, by, bw, bh);
                } else { // 'rounded'
                    rrect(ctx, bx, by, bw, bh, 6);
                }

                if (S.transparentBg) {
                    ctx.clearRect(bx, by, bw, bh);
                } else {
                    ctx.fillStyle = S.colorLogoBg || '#ffffff';
                    ctx.fill();
                }
            }

            // Aspect ratio calculation to avoid stretching non-1:1 logos
            const nw = img.naturalWidth || img.width || 1;
            const nh = img.naturalHeight || img.height || 1;
            const aspect = nw / nh;
            let drawW = ls, drawH = ls;
            if (aspect > 1) {
                drawH = ls / aspect;
            } else {
                drawW = ls * aspect;
            }
            const drawX = lx + (ls - drawW) / 2;
            const drawY = ly + (ls - drawH) / 2;

            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            if (callbackAfterLogo) callbackAfterLogo();
        };
        img.src = S.logoDataUrl;
    } else {
        if (callbackAfterLogo) callbackAfterLogo();
    }
}

// ── Dot shapes ──
function dot(ctx, x, y, cs, style) {
    const p = cs * 0.1, s = cs - p * 2;
    switch (style) {
        case 'dots':
            ctx.arc(x + cs / 2, y + cs / 2, s / 2, 0, Math.PI * 2);
            break;
        case 'rounded':
            rrect(ctx, x + p, y + p, s, s, s * 0.35);
            break;
        case 'diamond':
            ctx.moveTo(x + cs / 2, y + p);
            ctx.lineTo(x + cs - p, y + cs / 2);
            ctx.lineTo(x + cs / 2, y + cs - p);
            ctx.lineTo(x + p,      y + cs / 2);
            ctx.closePath();
            break;
        case 'lines':
            ctx.rect(x, y + cs * 0.31, cs, cs * 0.38);
            break;
        default:
            ctx.rect(x + p, y + p, s, s);
    }
}

// ── Eye shape with split Outer & Inner ──
function eye(ctx, x, y, sz, outerStyle, innerStyle, fgOuter, fgInner, bg, isTransparent) {
    const sw = sz / 7;
    const rOuter = outerStyle === 'circle' ? sz / 2 : outerStyle === 'rounded' ? sz * 0.22 : 0;
    const rCut   = Math.max(0, rOuter - sw * 0.8);
    const ds     = sz * (3 / 7);
    const rInner = innerStyle === 'circle' ? ds / 2 : innerStyle === 'rounded' ? ds * 0.22 : 0;

    // Outer Frame
    ctx.fillStyle = fgOuter;
    ctx.beginPath(); rrect(ctx, x, y, sz, sz, rOuter); ctx.fill();

    // Cutout
    ctx.beginPath(); rrect(ctx, x + sw, y + sw, sz - sw * 2, sz - sw * 2, rCut);
    if (isTransparent) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    } else {
        ctx.fillStyle = bg;
        ctx.fill();
    }

    // Inner Center Dot
    const cx = x + sz / 2 - ds / 2, cy = y + sz / 2 - ds / 2;
    ctx.fillStyle = fgInner;
    ctx.beginPath(); rrect(ctx, cx, cy, ds, ds, rInner); ctx.fill();
}

function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y,   x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x,   y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function isFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

// ─────────────────────────────────────────────────────────────
//  DESIGN CONTROLS
// ─────────────────────────────────────────────────────────────
function setupDesignToggle() {
    const hdr  = document.getElementById('designToggle');
    const body = document.getElementById('designBody');
    const arr  = document.getElementById('designArrow');
    hdr?.addEventListener('click', () => {
        const open = body.classList.toggle('open');
        if (arr) arr.textContent = open ? '▲' : '▼';
    });
}

function setupColors() {
    link('cFg',        'cFgHex',        v => { S.colorFg        = v; generate(); });
    link('cFg2',       'cFg2Hex',       v => { S.colorFg2       = v; generate(); });
    link('cEyeOut',    'cEyeOutHex',    v => { S.colorEyeOuter  = v; generate(); });
    link('cEyeIn',     'cEyeInHex',     v => { S.colorEyeInner  = v; generate(); });
    link('cBg',        'cBgHex',        v => { S.colorBg        = v; generate(); });
    link('cFrame',     'cFrameHex',     v => { S.colorFrame     = v; generate(); });
    link('cLabelText', 'cLabelTextHex', v => { S.colorLabelText = v; generate(); });
    link('cLogoBg',    'cLogoBgHex',    v => { S.colorLogoBg    = v; generate(); });

    document.getElementById('transparentBg')?.addEventListener('change', e => {
        S.transparentBg = e.target.checked;
        generate();
    });

    document.getElementById('useGradient')?.addEventListener('change', e => {
        S.useGradient = e.target.checked;
        const extras = document.getElementById('gradientExtras');
        if (extras) extras.style.display = S.useGradient ? 'flex' : 'none';
        generate();
    });

    document.getElementById('gradientDir')?.addEventListener('change', e => {
        S.gradientDir = e.target.value;
        generate();
    });

    document.querySelectorAll('.preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const fg = btn.dataset.fg, bg = btn.dataset.bg, eo = btn.dataset.eo, ei = btn.dataset.ei;
            applyCol('cFg',     'cFgHex',     fg);
            applyCol('cEyeOut', 'cEyeOutHex', eo);
            applyCol('cEyeIn',  'cEyeInHex',  ei);
            applyCol('cBg',     'cBgHex',     bg);
            S.colorFg = fg; S.colorEyeOuter = eo; S.colorEyeInner = ei; S.colorBg = bg;
            generate();
        });
    });
}

function link(cId, hId, cb) {
    const c = document.getElementById(cId), h = document.getElementById(hId);
    if (!c || !h) return;
    c.addEventListener('input', e => { h.value = e.target.value.toUpperCase(); cb(e.target.value); });
    h.addEventListener('input', e => {
        if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) { c.value = e.target.value; cb(e.target.value); }
    });
}

function applyCol(cId, hId, val) {
    const c = document.getElementById(cId), h = document.getElementById(hId);
    if (c) c.value = val;
    if (h) h.value = val.toUpperCase();
}

function setupStyles() {
    bindGroup('#dotStyleRow',     'data-dot',         v => { S.dotStyle      = v; generate(); });
    bindGroup('#eyeOuterRow',     'data-eyeouter',    v => { S.eyeOuterStyle = v; generate(); });
    bindGroup('#eyeInnerRow',     'data-eyeinner',    v => { S.eyeInnerStyle = v; generate(); });
    bindGroup('#logoBgShapeRow',  'data-logobgshape', v => { S.logoBgShape   = v; generate(); });

    bindGroup('#frameStyleRow','data-frame',    v => {
        S.frameStyle = v;
        const extras    = document.getElementById('frameExtras');
        const lblWrap   = document.getElementById('labelInputWrap');
        const fontWrap  = document.getElementById('labelFontWrap');
        const colorWrap = document.getElementById('labelTextColorWrap');
        if (extras)    extras.style.display    = v !== 'none' ? 'flex' : 'none';
        if (lblWrap)   lblWrap.style.display   = v === 'badge' ? 'block' : 'none';
        if (fontWrap)  fontWrap.style.display  = v === 'badge' ? 'block' : 'none';
        if (colorWrap) colorWrap.style.display = v === 'badge' ? 'block' : 'none';
        generate();
    });

    document.getElementById('frameLabel')?.addEventListener('input', debounce(e => { S.frameLabel = e.target.value; generate(); }, 300));
    document.getElementById('frameFont')?.addEventListener('change', e => { S.frameFont = e.target.value; generate(); });
    document.getElementById('ecLevel')?.addEventListener('change',   e => { S.ecLevel = e.target.value; generate(); });
}

function bindGroup(sel, attr, cb) {
    document.querySelectorAll(`${sel} .style-btn`).forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll(`${sel} .style-btn`).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            cb(btn.getAttribute(attr));
        });
    });
}

// ─────────────────────────────────────────────────────────────
//  LOGO
// ─────────────────────────────────────────────────────────────
function setupLogo() {
    const inp    = document.getElementById('logoFile');
    const btn    = document.getElementById('logoBtn');
    const drop   = document.getElementById('logoDrop');
    const rm     = document.getElementById('logoRemove');
    const slider = document.getElementById('logoSz');
    const szLbl  = document.getElementById('logoSzVal');

    btn?.addEventListener('click', () => inp?.click());
    inp?.addEventListener('change', e => handleLogo(e.target.files[0]));

    drop?.addEventListener('dragover',  e => { e.preventDefault(); drop.classList.add('drag-over'); });
    drop?.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
    drop?.addEventListener('drop', e => {
        e.preventDefault(); drop.classList.remove('drag-over');
        handleLogo(e.dataTransfer.files[0]);
    });

    rm?.addEventListener('click', () => {
        S.logoDataUrl = null;
        if (inp) inp.value = '';
        document.getElementById('logoLoaded').classList.add('hidden');
        document.getElementById('logoDrop').classList.remove('hidden');
        generate();
    });

    slider?.addEventListener('input', () => {
        S.logoSize = parseInt(slider.value);
        if (szLbl) szLbl.textContent = slider.value;
        if (S.logoDataUrl) generate();
    });
}

function handleLogo(file) {
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) { alert('Bitte eine Datei unter 2MB wählen.'); return; }
    const reader = new FileReader();
    reader.onload = e => {
        S.logoDataUrl = e.target.result;
        const img = document.getElementById('logoImg');
        if (img) img.src = e.target.result;
        document.getElementById('logoDrop').classList.add('hidden');
        document.getElementById('logoLoaded').classList.remove('hidden');
        if (S.ecLevel !== 'H') {
            const ec = document.getElementById('ecLevel');
            if (ec) { ec.value = 'H'; S.ecLevel = 'H'; }
        }
        generate();
    };
    reader.readAsDataURL(file);
}

// ─────────────────────────────────────────────────────────────
//  DOWNLOAD & COPY
// ─────────────────────────────────────────────────────────────
function setupDownload() {
    document.querySelectorAll('.size-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            S.dlSize = parseInt(btn.dataset.sz);
        });
    });
    document.getElementById('dlPng')?.addEventListener('click', downloadPNG);
    document.getElementById('dlSvg')?.addEventListener('click', downloadSVG);
}

function setupCopy() {
    document.getElementById('copyBtn')?.addEventListener('click', () => {
        if (!S.matrix) return;
        const off = document.createElement('canvas');
        drawQR(off, S.matrix, 512, () => {
            off.toBlob(blob => {
                try {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    const btn = document.getElementById('copyBtn');
                    if (btn) {
                        const oldText = btn.textContent;
                        btn.textContent = '✓ Kopiert!';
                        setTimeout(() => btn.textContent = oldText, 2000);
                    }
                } catch(err) {
                    alert('Kopieren in Zwischenablage wird von diesem Browser nicht unterstützt.');
                }
            });
        });
    });
}

function getFilename(ext) {
    const raw = (document.getElementById('dlFilename')?.value || 'qr-code').trim();
    const safe = raw.replace(/[^a-zA-Z0-9_\-äöüÄÖÜ]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g,'');
    return (safe || 'qr-code') + '.' + ext;
}

function downloadPNG() {
    if (!S.matrix) return;
    const off = document.createElement('canvas');
    drawQR(off, S.matrix, S.dlSize, () => {
        const a = document.createElement('a');
        a.download = getFilename('png');
        a.href = off.toDataURL('image/png');
        a.click();
    });
}

function downloadSVG() {
    if (!S.matrix) return;

    const mat = S.matrix, n = mat.length, cs = 10;
    const sz  = n * cs;
    const hasBdr = S.frameStyle !== 'none';
    const hasLbl = S.frameStyle === 'badge';
    const pd  = hasBdr ? cs * 2 : 0;
    const lH  = hasLbl ? cs * 4 : 0;
    const W   = sz + pd * 2, H = sz + pd * 2 + lH;
    const bg  = S.transparentBg ? 'none' : S.colorBg;
    const eo  = S.colorEyeOuter, ei = S.colorEyeInner;

    let defs = '';
    let fg   = S.colorFg;

    if (S.useGradient) {
        let x1 = "0%", y1 = "0%", x2 = "100%", y2 = "100%";
        if (S.gradientDir === 'horiz') { x2 = "100%"; y2 = "0%"; }
        else if (S.gradientDir === 'vert') { x1 = "0%"; y1 = "0%"; x2 = "0%"; y2 = "100%"; }
        defs += `<defs><linearGradient id="qrGrad" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0%" stop-color="${S.colorFg}"/><stop offset="100%" stop-color="${S.colorFg2 || '#ec4899'}"/></linearGradient></defs>`;
        fg = 'url(#qrGrad)';
    }

    let body = S.transparentBg ? '' : `<rect width="${W}" height="${H}" fill="${bg}"/>`;

    if (hasBdr) {
        const br = S.frameStyle === 'rounded' || S.frameStyle === 'badge' ? 12 : 3;
        body += `<rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="${S.colorFrame}" stroke-width="2.5" rx="${br}"/>`;
    }

    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (!mat[r][c] || isFinder(r, c, n)) continue;
        const x = pd + c * cs, y = pd + r * cs, p = cs * 0.1, s = cs - p * 2;
        switch (S.dotStyle) {
            case 'dots':
                body += `<circle cx="${x+cs/2}" cy="${y+cs/2}" r="${s/2}" fill="${fg}"/>`;
                break;
            case 'rounded':
                body += `<rect x="${x+p}" y="${y+p}" width="${s}" height="${s}" rx="${s*0.35}" fill="${fg}"/>`;
                break;
            case 'diamond':
                body += `<polygon points="${x+cs/2},${y+p} ${x+cs-p},${y+cs/2} ${x+cs/2},${y+cs-p} ${x+p},${y+cs/2}" fill="${fg}"/>`;
                break;
            case 'lines':
                body += `<rect x="${x}" y="${y+cs*0.31}" width="${cs}" height="${cs*0.38}" fill="${fg}"/>`;
                break;
            default:
                body += `<rect x="${x+p}" y="${y+p}" width="${s}" height="${s}" fill="${fg}"/>`;
        }
    }

    [[0,0],[0,n-7],[n-7,0]].forEach(([r,c]) => {
        const x = pd+c*cs, y = pd+r*cs, esz = cs*7, sw = cs, ds = cs*3;
        const er = S.eyeOuterStyle === 'circle' ? esz/2 : S.eyeOuterStyle === 'rounded' ? esz*0.22 : 0;
        const ir = Math.max(0, er - sw*0.8);
        const dr = S.eyeInnerStyle === 'circle' ? ds/2  : S.eyeInnerStyle === 'rounded' ? ds*0.22  : 0;

        body += `<rect x="${x}" y="${y}" width="${esz}" height="${esz}" rx="${er}" fill="${eo}"/>`;
        if (S.transparentBg) {
            body += `<rect x="${x+sw}" y="${y+sw}" width="${esz-sw*2}" height="${esz-sw*2}" rx="${ir}" fill="#ffffff"/>`;
        } else {
            body += `<rect x="${x+sw}" y="${y+sw}" width="${esz-sw*2}" height="${esz-sw*2}" rx="${ir}" fill="${bg}"/>`;
        }
        body += `<rect x="${x+sw*2}" y="${y+sw*2}" width="${ds}" height="${ds}" rx="${dr}" fill="${ei}"/>`;
    });

    if (hasLbl) {
        body += `<rect x="0" y="${H-lH}" width="${W}" height="${lH}" fill="${S.colorFrame}"/>`;
        const fontFam = (S.frameFont || 'Inter').split(',')[0].replace(/'/g, '');
        body += `<text x="${W/2}" y="${H-lH/2}" text-anchor="middle" dominant-baseline="middle" font-family="${xmlEsc(fontFam)}, Arial, sans-serif" font-weight="bold" font-size="${lH*0.42}" fill="${S.colorLabelText || '#fff'}">${xmlEsc(S.frameLabel||'SCAN ME!')}</text>`;
    }

    // Logo embedding in SVG
    if (S.logoDataUrl) {
        const ls   = sz * (S.logoSize / 100);
        const lx   = pd + (sz - ls) / 2;
        const ly   = pd + (sz - ls) / 2;
        const padL = ls * 0.1;
        const bw   = ls + padL * 2;
        const bh   = ls + padL * 2;
        const bx   = lx - padL;
        const by   = ly - padL;
        const logoBgCol = S.colorLogoBg || (S.transparentBg ? '#ffffff' : S.colorBg);

        if (S.logoBgShape !== 'none') {
            if (S.logoBgShape === 'circle') {
                body += `<circle cx="${lx + ls/2}" cy="${ly + ls/2}" r="${bw/2}" fill="${logoBgCol}"/>`;
            } else if (S.logoBgShape === 'square') {
                body += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${logoBgCol}"/>`;
            } else { // rounded
                body += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" fill="${logoBgCol}"/>`;
            }
        }

        body += `<image href="${xmlEsc(S.logoDataUrl)}" x="${lx}" y="${ly}" width="${ls}" height="${ls}" preserveAspectRatio="xMidYMid meet"/>`;
    }

    const svgStr = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>QR Code – ${S.type}</title>${defs}${body}</svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.download = getFilename('svg');
    a.href = url; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
}

// ─────────────────────────────────────────────────────────────
//  RESET & HERO
// ─────────────────────────────────────────────────────────────
function setupReset() {
    document.getElementById('resetBtn')?.addEventListener('click', () => {
        document.querySelectorAll('.forms input:not([type=file]), .forms textarea').forEach(el => el.value = '');
        document.querySelectorAll('.forms select').forEach(el => el.selectedIndex = 0);

        S.type = 'url';
        document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === 'url'));
        document.querySelectorAll('.form-block').forEach(f => f.classList.remove('active'));
        document.getElementById('form-url')?.classList.add('active');
        document.getElementById('currentTypeLabel').textContent = TYPE_LABELS.url;

        S.colorFg = '#000000'; S.colorFg2 = '#ec4899'; S.useGradient = false; S.gradientDir = 'diag';
        S.colorEyeOuter = '#000000'; S.colorEyeInner = '#000000';
        S.colorBg = '#ffffff'; S.colorFrame = '#6366f1'; S.transparentBg = false;
        applyCol('cFg',     'cFgHex',     '#000000');
        applyCol('cFg2',    'cFg2Hex',    '#EC4899');
        applyCol('cEyeOut', 'cEyeOutHex', '#000000');
        applyCol('cEyeIn',  'cEyeInHex',  '#000000');
        applyCol('cBg',     'cBgHex',     '#ffffff');
        applyCol('cFrame',  'cFrameHex',  '#6366f1');
        applyCol('cLogoBg', 'cLogoBgHex', '#FFFFFF');

        const tBg = document.getElementById('transparentBg');
        if (tBg) tBg.checked = false;

        const uGrad = document.getElementById('useGradient');
        if (uGrad) uGrad.checked = false;
        const gExt = document.getElementById('gradientExtras');
        if (gExt) gExt.style.display = 'none';

        S.dotStyle = 'square'; S.eyeOuterStyle = 'square'; S.eyeInnerStyle = 'square'; S.frameStyle = 'none';
        S.frameLabel = 'SCAN ME!'; S.ecLevel = 'M'; S.logoBgShape = 'rounded'; S.colorLogoBg = '#ffffff';

        document.querySelectorAll('#dotStyleRow .style-btn').forEach(b => b.classList.toggle('active', b.dataset.dot === 'square'));
        document.querySelectorAll('#eyeOuterRow .style-btn').forEach(b => b.classList.toggle('active', b.dataset.eyeouter === 'square'));
        document.querySelectorAll('#eyeInnerRow .style-btn').forEach(b => b.classList.toggle('active', b.dataset.eyeinner === 'square'));
        document.querySelectorAll('#frameStyleRow .style-btn').forEach(b => b.classList.toggle('active', b.dataset.frame === 'none'));
        document.querySelectorAll('#logoBgShapeRow .style-btn').forEach(b => b.classList.toggle('active', b.dataset.logobgshape === 'rounded'));
        document.getElementById('frameExtras').style.display = 'none';
        document.getElementById('ecLevel').value = 'M';

        S.logoDataUrl = null;
        const li = document.getElementById('logoFile'); if (li) li.value = '';
        document.getElementById('logoLoaded').classList.add('hidden');
        document.getElementById('logoDrop').classList.remove('hidden');
        const sz = document.getElementById('logoSz');
        const szL = document.getElementById('logoSzVal');
        if (sz)  sz.value = '20';
        if (szL) szL.textContent = '20';
        S.logoSize = 20;

        const fn = document.getElementById('dlFilename'); if (fn) fn.value = 'mein-qr-code';

        showQR(false);
        document.getElementById('qrInfo').style.display    = 'none';
        document.getElementById('dlSection').style.display = 'none';
        S.matrix = null;
    });
}

function buildHeroQR() {
    try {
        const qr  = QRCode.create('https://qrcraft.io', { errorCorrectionLevel: 'M' });
        const { size, data: raw } = qr.modules;
        const mat = [];
        for (let r = 0; r < size; r++) {
            const row = [];
            for (let c = 0; c < size; c++) row.push(raw[r * size + c] !== 0);
            mat.push(row);
        }
        drawQR(document.getElementById('heroQr'), mat, 180);
    } catch(e) { console.warn('Hero QR error:', e); }
}

window.jumpToType = function(type) {
    S.type = type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    document.querySelectorAll('.form-block').forEach(f => f.classList.remove('active'));
    document.getElementById('form-' + type)?.classList.add('active');
    document.getElementById('currentTypeLabel').textContent = TYPE_LABELS[type] || type;
    generate();
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function we(s)      { return (s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/"/g,'\\"'); }
function ical(dt)   { return dt ? dt.replace(/[-:T]/g,'').slice(0,13)+'00' : ''; }
function xmlEsc(s)  { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
