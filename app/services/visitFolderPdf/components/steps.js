// services/visitFolderPdf/components/steps.js
const { icon } = require("../utils/icons");

function stepList(steps = []) {
  return `
    <div class="step-list">
      ${steps.map((step, index) => `
        <div class="step-item">
          <div class="step-row">
            <div class="step-icon">${icon(step.icon, 22)}</div>

            <div class="step-content">
              <div class="step-title">${step.title}</div>
              <p class="step-desc">${step.text}</p>
            </div>
          </div>

          ${index < steps.length - 1 ? `
            <div class="step-arrow" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 5V19M12 19L6 13M12 19L18 13"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          ` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

module.exports = { stepList };
