/* content.js */

// Configuration
// Combined Regex for EVM, BTC, SOL
const MULTI_CHAIN_REGEX = /((?:0x[a-fA-F0-9]{40})|(?:\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}\b)|(?:\b[1-9A-HJ-NP-Za-km-z]{32,44}\b))/g;
// For quick check (non-global)
const MULTI_CHAIN_CHECK = /((?:0x[a-fA-F0-9]{40})|(?:\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}\b)|(?:\b[1-9A-HJ-NP-Za-km-z]{32,44}\b))/;

const IGNORE_TAGS = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE'];

const COPY_ICON_SVG = `
<svg viewBox="0 0 24 24">
  <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/>
</svg>`;

const COPIED_ICON_SVG = `
<svg viewBox="0 0 24 24">
  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
</svg>`;

const LABEL_ICON_URL = chrome.runtime.getURL('icons/icon16.png');

let addressMap = {};

// Helper: Normalize address for lookup
function normalizeKey(addr) {
    if (!addr) return '';
    // EVM Addresses are case-insensitive, store as lowercase
    if (addr.match(/^0x[a-fA-F0-9]{40}$/i)) {
        return addr.toLowerCase();
    }
    // BTC (Legacy/Script) and SOL are case-sensitive.
    // BTC Bech32 (bc1...) is actually case-insensitive but standard is lowercase.
    // For simplicity, we can try exact match first, then lowercase for bc1?
    // Current Popup.js saves 'bc1' as is (usually input as lowercase).
    // Let's keep it simple: return as is for non-EVM.
    return addr;
}

// Load saved addresses
chrome.storage.local.get(['addressMap'], (result) => {
    if (result.addressMap) {
        addressMap = result.addressMap;
        scanAndReplace(document.body);
    }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.addressMap) {
        addressMap = changes.addressMap.newValue || {};
        updateExistingReplacements();
        scanAndReplace(document.body);
    }
});

// DOM Observer for dynamic content
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // ELEMENT_NODE
                scanAndReplace(node);
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

function updateExistingReplacements() {
    const replacements = document.querySelectorAll('.address-label-replaced');
    replacements.forEach(span => {
        const addr = span.getAttribute('data-original-address');
        const key = normalizeKey(addr);

        if (key && addressMap[key]) {
            const nickname = addressMap[key];
            // Rebuild to ensure icon and structure
            span.innerHTML = `<img src="${LABEL_ICON_URL}" class="address-label-icon" />${nickname}`;
        }
    });
}

function scanAndReplace(rootNode) {
    if (!rootNode) return;

    // Safety check to ensure we are not inside an ignored tag
    if (rootNode.nodeType === 1 && IGNORE_TAGS.includes(rootNode.tagName)) return;

    const treeWalker = document.createTreeWalker(
        rootNode,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: function (node) {
                // Skip if we are inside a replaced element (including tooltips)
                if (node.parentElement && node.parentElement.closest('.address-label-replaced')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Skip ignored tags
                if (node.parentElement && IGNORE_TAGS.includes(node.parentElement.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Editable fields check
                if (node.parentElement && node.parentElement.isContentEditable) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (MULTI_CHAIN_CHECK.test(node.nodeValue)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    const nodesToReplace = [];
    while (treeWalker.nextNode()) {
        nodesToReplace.push(treeWalker.currentNode);
    }

    nodesToReplace.forEach(node => {
        const text = node.nodeValue;

        let hasMatch = false;
        let tempHtml = text.replace(MULTI_CHAIN_REGEX, (match) => {
            const key = normalizeKey(match);
            if (addressMap[key]) {
                hasMatch = true;
                const nickname = addressMap[key];
                return `<span class="address-label-replaced" data-original-address="${match}"><img src="${LABEL_ICON_URL}" class="address-label-icon" />${nickname}</span>`;
            }
            return match;
        });

        if (hasMatch && tempHtml !== text) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = tempHtml;
            const parent = node.parentNode;
            if (parent) {
                while (wrapper.firstChild) {
                    parent.insertBefore(wrapper.firstChild, node);
                }
                parent.removeChild(node);
            }
        }
    });
}

// Add global click listener for copy functionality
// --- Global Tooltip UI ---

const tooltip = document.createElement('div');
tooltip.className = 'address-tooltip';
// Initial structure
tooltip.innerHTML = `
    <span class="address-text"></span>
    <span class="copy-icon">${COPY_ICON_SVG}</span>
`;
if (document.body) {
    document.body.appendChild(tooltip);
} else {
    // Fallback if body not ready (unlikely for content script run_at_document_end but good practice)
    document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(tooltip);
    });
}

let tooltipHideTimeout;

function showTooltip(label) {
    const addr = label.getAttribute('data-original-address');
    if (!addr) return;

    tooltip.querySelector('.address-text').textContent = addr;
    tooltip.setAttribute('data-current-address', addr);

    // Reset copy state
    tooltip.classList.remove('copied');
    tooltip.querySelector('.copy-icon').innerHTML = COPY_ICON_SVG;

    tooltip.style.display = 'flex';

    // Positioning
    const rect = label.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Default: Top centered
    let top = rect.top - tooltipRect.height - 8;
    let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

    // Flip to bottom if not enough space on top
    if (top < 0) {
        top = rect.bottom + 8;
        // Adjust arrow direction logic here if needed via class, 
        // but for simplicity we keep one style or just rely on floating look.
    }

    // Keep within horizontal bounds
    if (left < 5) left = 5;
    if (left + tooltipRect.width > window.innerWidth - 5) {
        left = window.innerWidth - tooltipRect.width - 5;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function hideTooltip() {
    tooltip.style.display = 'none';
}

// Event Delegation for Tooltip Interactions
document.addEventListener('mouseover', (e) => {
    const label = e.target.closest('.address-label-replaced');
    const tooltipEl = e.target.closest('.address-tooltip');

    if (label) {
        clearTimeout(tooltipHideTimeout);
        showTooltip(label);
    } else if (tooltipEl) {
        // If hovering the tooltip itself, keep it open
        clearTimeout(tooltipHideTimeout);
    }
});

document.addEventListener('mouseout', (e) => {
    const label = e.target.closest('.address-label-replaced');
    const tooltipEl = e.target.closest('.address-tooltip');

    // Only set hide timeout if we are leaving relevant elements
    if (label || tooltipEl) {
        tooltipHideTimeout = setTimeout(() => {
            hideTooltip();
        }, 300); // Small delay to allow moving from label to tooltip
    }
});

// Copy Logic (Updated for Global Tooltip)
tooltip.addEventListener('click', (e) => {
    // Prevent closing or bubbling
    e.stopPropagation();
    e.preventDefault();

    const addr = tooltip.getAttribute('data-current-address');
    if (addr) {
        navigator.clipboard.writeText(addr).then(() => {
            const icon = tooltip.querySelector('.copy-icon');
            if (icon) {
                const originalIcon = COPY_ICON_SVG; // Use constant
                tooltip.classList.add('copied');
                icon.innerHTML = COPIED_ICON_SVG;

                setTimeout(() => {
                    if (tooltip.getAttribute('data-current-address') === addr) {
                        tooltip.classList.remove('copied');
                        icon.innerHTML = originalIcon;
                    }
                }, 2000);
            }
        });
    }
});

// --- Selection UI ---

// Create the popup element (injected into page)
const popup = document.createElement('div');
popup.id = 'address-label-popup';
popup.style.display = 'none';

popup.innerHTML = `
    <button class="close-btn">&times;</button>
    <h3>Add Address Label</h3>
    <input type="text" id="address-label-name" placeholder="Enter nickname">
    <input type="hidden" id="address-label-addr">
    <button id="address-label-save">Save</button>
`;
if (document.body) {
    document.body.appendChild(popup);
}

// Create the trigger button (small icon)
const triggerBtn = document.createElement('div');
triggerBtn.id = 'address-label-trigger';
triggerBtn.innerHTML = `
<svg viewBox="0 0 24 24">
  <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16zM16 17H5V7h11l3.55 5L16 17z"/>
</svg>`;
// Alternative icon (plus): <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
// Using label-like icon above.

if (document.body) {
    document.body.appendChild(triggerBtn);
}

const nameInput = popup.querySelector('#address-label-name');
const addrInput = popup.querySelector('#address-label-addr');
const saveBtn = popup.querySelector('#address-label-save');
const closeBtn = popup.querySelector('.close-btn');

function closePopup() {
    popup.style.display = 'none';
    nameInput.value = '';
}

function closeTrigger() {
    triggerBtn.style.display = 'none';
}

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopup();
});

triggerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Show popup
    const top = parseInt(triggerBtn.style.top);
    const left = parseInt(triggerBtn.style.left);

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    popup.style.display = 'block';

    // Hide trigger
    closeTrigger();

    // Populate name
    const addr = addrInput.value;
    const key = normalizeKey(addr);

    chrome.storage.local.get(['addressMap'], (result) => {
        const map = result.addressMap || {};
        if (map[key]) {
            nameInput.value = map[key];
        } else {
            nameInput.value = '';
        }
        nameInput.focus();
    });
});


saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const name = nameInput.value.trim();
    const addr = addrInput.value;

    if (name && addr) {
        // Check formatting one last time? Not strictly needed if input came from valid selection.
        chrome.storage.local.get(['addressMap'], (result) => {
            const map = result.addressMap || {};
            // Use normalizeKey for consistency
            map[normalizeKey(addr)] = name;
            chrome.storage.local.set({ addressMap: map }, () => {
                closePopup();
            });
        });
    }
});

popup.addEventListener('mouseup', (e) => {
    e.stopPropagation();
});
popup.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});
triggerBtn.addEventListener('mouseup', (e) => {
    e.stopPropagation();
});
triggerBtn.addEventListener('mousedown', (e) => {
    e.stopPropagation();
});

// Listen for selection
document.addEventListener('mouseup', (e) => {
    if (popup.contains(e.target) || triggerBtn.contains(e.target)) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) {
        // If clicked elsewhere and no selection, close everything
        if (popup.style.display === 'block') closePopup();
        if (triggerBtn.style.display !== 'none') closeTrigger();
        return;
    }

    // Strict validation for popup to avoid false positives
    const isEVM = /^0x[a-fA-F0-9]{40}$/i.test(selectedText);
    const isBTC = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}$/.test(selectedText);
    const isSOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(selectedText);

    if (isEVM || isBTC || isSOL) {
        // Prepare data but don't show popup yet
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        addrInput.value = selectedText;

        const top = window.scrollY + rect.bottom + 5;
        const left = window.scrollX + rect.right + 5; // Position near end of selection

        // Show trigger instead of popup
        triggerBtn.style.top = `${top}px`;
        triggerBtn.style.left = `${left}px`;
        triggerBtn.style.display = 'flex';

        // Hide popup if it was open for another address (optional logic, but safe to close)
        closePopup();

    } else {
        if (popup.style.display === 'block') {
            closePopup();
        }
        closeTrigger();
    }
});
