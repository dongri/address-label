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
            span.innerHTML = `
                <img src="${LABEL_ICON_URL}" class="address-label-icon" />
                ${nickname}
                <span class="address-tooltip">
                    ${addr}
                    <span class="copy-icon">${COPY_ICON_SVG}</span>
                </span>
             `;
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
                return `<span class="address-label-replaced" data-original-address="${match}">
                    <img src="${LABEL_ICON_URL}" class="address-label-icon" />
                    ${nickname}
                    <span class="address-tooltip">
                        ${match}
                        <span class="copy-icon">${COPY_ICON_SVG}</span>
                    </span>
                </span>`;
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
document.addEventListener('click', (e) => {
    // Only intercept clicks within the tooltip (address or copy icon)
    // The closest() method will find the .address-tooltip wrapper if clicked on text or icon inside it
    const tooltipWrapper = e.target.closest('.address-tooltip');

    if (tooltipWrapper) {
        // Find the parent label that holds the address data
        const label = tooltipWrapper.closest('.address-label-replaced');

        if (label) {
            // Prevent default behavior (navigating links) and stopping bubbling
            e.preventDefault();
            e.stopPropagation();

            const addr = label.getAttribute('data-original-address');
            if (addr) {
                navigator.clipboard.writeText(addr).then(() => {
                    // Show feedback
                    const icon = tooltipWrapper.querySelector('.copy-icon');

                    if (icon) {
                        const originalIcon = icon.innerHTML;

                        tooltipWrapper.classList.add('copied');
                        icon.innerHTML = COPIED_ICON_SVG;

                        setTimeout(() => {
                            tooltipWrapper.classList.remove('copied');
                            icon.innerHTML = originalIcon;
                        }, 2000);
                    }
                });
            }
        }
    }
    // If click matches .address-label-replaced but NOT .address-tooltip (i.e. the nickname),
    // we do nothing here, allowing the event to bubble and trigger standard link navigation.
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

const nameInput = popup.querySelector('#address-label-name');
const addrInput = popup.querySelector('#address-label-addr');
const saveBtn = popup.querySelector('#address-label-save');
const closeBtn = popup.querySelector('.close-btn');

function closePopup() {
    popup.style.display = 'none';
    nameInput.value = '';
}

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopup();
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

// Listen for selection
document.addEventListener('mouseup', (e) => {
    if (popup.contains(e.target)) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Strict validation for popup to avoid false positives
    const isEVM = /^0x[a-fA-F0-9]{40}$/i.test(selectedText);
    const isBTC = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}$/.test(selectedText);
    const isSOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(selectedText);

    if (isEVM || isBTC || isSOL) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        addrInput.value = selectedText;

        const top = window.scrollY + rect.bottom + 10;
        const left = window.scrollX + rect.left;

        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.style.display = 'block';

        const key = normalizeKey(selectedText);

        chrome.storage.local.get(['addressMap'], (result) => {
            const map = result.addressMap || {};
            if (map[key]) {
                nameInput.value = map[key];
            } else {
                nameInput.value = '';
            }
            nameInput.focus();
        });
    } else {
        if (popup.style.display === 'block') {
            closePopup();
        }
    }
});
