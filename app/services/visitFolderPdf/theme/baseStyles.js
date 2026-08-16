// services/visitFolderPdf/theme/baseStyles.js
function baseStyles(brand) {
  return `
    :root {
      --brand: ${brand.color || "#976DD0"};
      --brand-rgb: ${brand.rgb || "151, 109, 208"};
      --text: #2F3A46;
      --muted: #6B7280;
      --muted-strong: #4B5563;
      --line: #D7DCE2;
      --line-soft: #EEF0F3;
      --soft: #FAFBFC;
      --soft-2: #FBFCFD;
    }

    @page {
      margin: 0;
      size: A4 portrait;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      font-family: Helvetica, Arial, sans-serif;
      color: var(--text);
      background: #fff;
    }

    body {
      width: 210mm;
    }

    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      overflow: hidden;
      background: #fff;
    }

    .page:last-child {
      page-break-after: auto;
    }

    .page-shell {
      position: relative;
      z-index: 2;
      padding: 34px 46px 78px;
      min-height: 297mm;
    }

    .page-shell--top-spaced {
      padding-top: 68px;
    }

    .page-subtitle {
      font-size: 12px;
      line-height: 1.3;
      color: var(--muted);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 4px;
    }

    .page-title {
      font-size: 22px;
      line-height: 1.15;
      font-weight: 800;
      color: var(--brand);
      margin-bottom: 16px;
    }

    .page-title--spaced {
      margin-bottom: 32px;
    }

    .section-title {
      font-size: 13.5px;
      line-height: 1.3;
      font-weight: 700;
      color: var(--text);
      margin: 16px 0 7px;
    }

    .panel {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px 16px;
    }

    .panel--alt {
      background: var(--soft-2);
    }

    .panel p,
    .panel strong,
    .panel ul,
    .panel li {
      font-size: 12.5px;
      color: var(--text);
      line-height: 1.55;
      margin: 0 0 6px;
    }

    .panel ul {
      padding-left: 18px;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 16px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px 14px;
    }

    .vf-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 5px;
    }

    .vf-icon,
    .vf-icon svg {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #1F2937;
      flex-shrink: 0;
    }

    .vf-label {
      font-size: 12.5px;
      color: var(--text);
      font-weight: 600;
    }

    .vf-value {
      font-size: 12.5px;
      color: var(--muted);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 8px 20px;
      min-height: 36px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      background: var(--brand);
    }

    .brand-orb {
      position: absolute;
      bottom: -80px;
      right: -100px;
      width: 420px;
      height: 420px;
      border-radius: 50%;
      background:
        radial-gradient(
          circle at 30% 30%,
          rgba(var(--brand-rgb), 0.14),
          rgba(var(--brand-rgb), 0.04) 60%,
          transparent 70%
        );
      z-index: 1;
    }

    .footer-logo {
      position: absolute;
      bottom: 12px;
      right: 26px;
      z-index: 3;
      height: 30px;
      max-width: 120px;
      object-fit: contain;
    }

    .footer-logo--lg {
      height: 60px;
      max-width: 240px;
    }

    .site-url {
      position: absolute;
      bottom: 16px;
      left: 26px;
      font-size: 12px;
      font-weight: 700;
      color: var(--brand);
      z-index: 3;
    }

    .cover-label {
      color: #111827;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      text-align: center;
      margin-bottom: 6px;
    }

    .page-title--badge {
      display: block;
      width: fit-content;
      margin: 48px auto 96px;
      background: var(--brand);
      color: #fff;
      padding: 12px 28px;
      border-radius: 999px;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 800;
      text-align: center;
    }

    .cover-page.cover-page--fixed {
      position: relative;
      background: #fff;
    }

    .cover-fixed {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      overflow: hidden;
    }

    .cover-fixed-top {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 148mm;
    }

    .cover-fixed-photo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      background: #e9ecef;
    }

    .cover-fixed-photo--fallback {
      background: linear-gradient(
        135deg,
        rgba(var(--brand-rgb), 0.95),
        rgba(var(--brand-rgb), 0.62)
      );
    }

    .cover-fixed-bottom {
      position: absolute;
      left: 0;
      right: 0;
      top: 158mm;
      height: 108mm;
      padding: 0 24mm 0 18mm;
    }

    .cover-fixed-left {
      position: absolute;
      top: 0;
      left: 18mm;
      width: 112mm;
      height: 100%;
    }

    .cover-fixed-divider {
      position: absolute;
      top: 0mm;
      left: 138mm;
      width: 1px;
      height: 112mm;
      background: #d6dbe1;
    }

    .cover-fixed-right {
      position: absolute;
      top: 0;
      right: 12mm;
      width: 42mm;
      height: 100%;
    }

    .cover-fixed-label {
      position: absolute;
      top: 0;
      left: 0;
      font-size: 11px;
      line-height: 1.2;
      font-weight: 700;
      letter-spacing: 1.8px;
      text-transform: uppercase;
      color: var(--brand);
    }

    .cover-fixed-title {
      position: absolute;
      top: 4mm;
      left: 0;
      width: 100mm;
      min-height: 18mm;
      max-height: 18mm;
      overflow: hidden;
      font-size: 23px;
      line-height: 1.08;
      font-weight: 800;
      color: var(--text);
    }

    .cover-fixed-address {
      position: absolute;
      top: 18mm;
      left: 0;
      width: 98mm;
      font-size: 12.5px;
      line-height: 1.35;
      color: var(--muted);
    }

    .cover-fixed-owner {
      position: absolute;
      top: 22mm;
      left: 0;
      width: 98mm;
      font-size: 12.5px;
      line-height: 1.35;
      color: var(--text);
      font-weight: 700;
    }

    .cover-fixed-valorization-title {
      position: absolute;
      top: 34mm;
      left: 0;
      font-size: 14px;
      line-height: 1.25;
      font-weight: 800;
      color: var(--text);
    }

    .cover-fixed-valorization-list {
      position: absolute;
      top: 42mm;
      left: 0;
      width: 110mm;
      height: 46mm;
      overflow: hidden;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(5, minmax(0, 1fr));
      column-gap: 10mm;
      row-gap: 3mm;
    }

    .cover-fixed-valorization-item {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      min-height: 6mm;
      margin-bottom: 0;
    }

    .cover-fixed-valorization-icon,
    .cover-fixed-valorization-icon svg {
      width: 14px;
      height: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--brand);
      flex: 0 0 auto;
      margin-top: 1px;
    }

    .cover-fixed-valorization-text {
      font-size: 11.8px;
      line-height: 1.25;
      color: var(--text);
      font-weight: 600;
    }

    .cover-fixed-status-wrap {
      position: absolute;
      top: 1mm;
      left: 0;
      right: 0;
    }

    .cover-fixed-status {
      min-height: 34px;
      padding: 8px 18px;
      font-size: 13px;
    }

    .cover-fixed-price {
      position: absolute;
      top: 13mm;
      left: 0;
      width: 100%;
      font-size: 24px;
      line-height: 1.05;
      font-weight: 800;
      color: var(--brand);
    }

    .cover-fixed-metrics {
      position: absolute;
      top: 31mm;
      left: 0;
      width: 100%;
    }

    .cover-fixed-metric {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 9mm;
      margin-bottom: 2.2mm;
    }

    .cover-fixed-metric-icon,
    .cover-fixed-metric-icon svg {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #1f2937;
      flex: 0 0 auto;
    }

    .cover-fixed-metric-value {
      font-size: 14px;
      line-height: 1.3;
      color: var(--text);
      font-weight: 800;
    }

    .cover-fixed-qr {
      position: absolute;
      left: 18mm;
      bottom: 14mm;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 4;
    }

    .cover-fixed-qr img {
      width: 26mm;
      height: 26mm;
      object-fit: contain;
      display: block;
    }

    .cover-fixed-qr-copy {
      max-width: 52mm;
      font-size: 12px;
      line-height: 1.3;
      font-weight: 800;
      color: var(--brand);
    }

    .cover-fixed-footer-logo {
      position: absolute;
      right: 18mm;
      bottom: 14mm;
      width: 34mm;
      height: 12mm;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      z-index: 4;
    }

    .cover-fixed-footer-logo img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    .photo-grid img {
      width: 100%;
      height: 170px;
      object-fit: cover;
      border-radius: 10px;
      background: #EEE;
    }

    .plans-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .plans-grid img {
      width: 100%;
      height: auto;
      object-fit: contain;
      border-radius: 10px;
      background: #EEE;
    }

    .env-block {
      margin-bottom: 16px;
    }

    .env-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 6px;
    }

    .figures-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px 20px;
    }

    .figure-title {
      font-size: 14px;
      font-weight: 800;
      color: #1F2937;
      margin-bottom: 8px;
    }

    .figure-box {
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      padding: 10px 14px;
    }

    table.data-table {
      width: 100%;
      border-collapse: collapse;
    }

    table.data-table td {
      padding: 6px 8px;
      font-size: 12.5px;
      border-bottom: 1px solid var(--line-soft);
      vertical-align: top;
    }

    table.data-table td:first-child {
      color: var(--muted-strong);
    }

    table.data-table td:last-child {
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }

    .docs-section {
      margin-top: 30px;
      text-align: center;
    }

    .docs-section h3 {
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 14px;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 24px;
      max-width: 520px;
      margin: 0 auto;
      text-align: left;
    }

    .docs-grid span {
      font-size: 13px;
      color: #111827;
      font-weight: 600;
    }

    .docs-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .docs-item svg {
      flex: 0 0 auto;
      color: var(--brand);
    }

    .next-steps-page {
      padding-top: 6px;
    }

    .next-steps-qr {
      position: absolute;
      left: 30px;
      bottom: 24px;
      z-index: 3;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .next-steps-qr img {
      width: 92px;
      height: 92px;
      object-fit: contain;
      display: block;
    }

    .next-steps-qr-text {
      max-width: 52mm;
      font-size: 12px;
      line-height: 1.3;
      font-weight: 800;
      color: var(--brand);
    }

    .next-steps-intro {
      margin-top: 84px;
      margin-bottom: 48px;
      text-align: center;
    }

    .next-steps-intro .badge {
      margin: 0 auto 18px;
    }

    .next-steps-lead {
      max-width: 360px;
      margin: 0 auto;
      font-size: 20px;
      line-height: 1.28;
      font-weight: 800;
      color: var(--text);
      text-align: center;
    }

    .step-list {
      max-width: 430px;
      margin: 0 auto;
    }

    .step-item {
      margin-bottom: 8px;
    }

    .step-row {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      justify-content: center;
    }

    .step-icon {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: rgba(var(--brand-rgb), 0.14);
      color: var(--brand);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;
      max-width: 300px;
      padding-top: 2px;
    }

    .step-title {
      font-size: 15px;
      line-height: 1.3;
      font-weight: 800;
      color: var(--text);
      margin-bottom: 6px;
    }

    .step-desc {
      font-size: 13px;
      line-height: 1.5;
      color: var(--text);
      margin: 0;
    }

    .step-arrow {
      display: flex;
      justify-content: center;
      align-items: center;
      color: var(--brand);
      margin: 10px 0 12px;
    }

    .zone {
      margin-bottom: 56px;
    }

    .zone h3 {
      font-size: 16px;
      font-weight: 800;
      color: var(--brand);
      margin-bottom: 14px;
    }

    .zone-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .zone-item {
      padding: 6px 4px;
      text-align: center;
    }

    .zone-item .vf-icon {
      margin: 0 auto 8px;
      justify-content: center;
    }

    .zone-item p {
      font-size: 12.5px;
      color: var(--text);
      font-weight: 600;
      line-height: 1.35;
    }
  `;
}

module.exports = { baseStyles };
