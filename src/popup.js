// popup.js

const addressInput = document.getElementById('address');
const nicknameInput = document.getElementById('nickname');
const addBtn = document.getElementById('add-btn');
const listContainer = document.getElementById('list-container');

// Load and display addresses
function loadAddresses() {
    chrome.storage.local.get(['addressMap'], (result) => {
        const addressMap = result.addressMap || {};
        renderList(addressMap);
    });
}

function renderList(addressMap) {
    listContainer.innerHTML = '';

    if (Object.keys(addressMap).length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = '// No records found';
        listContainer.appendChild(empty);
        return;
    }

    // Convert to array and sort by nickname
    const items = Object.entries(addressMap).map(([addr, name]) => ({ addr, name }));
    items.sort((a, b) => a.name.localeCompare(b.name));

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'address-item';

        // Style buttons like code: [EDIT] [DEL]
        div.innerHTML = `
      <div class="address-info">
        <div class="nickname">${escapeHtml(item.name)}</div>
        <div class="address" title="${item.addr}">${item.addr}</div>
      </div>
      <div class="actions">
        <button class="action-btn edit-btn" data-addr="${item.addr}" data-name="${escapeHtml(item.name)}">EDIT</button>
        <button class="action-btn delete-btn" data-addr="${item.addr}">DEL</button>
      </div>
    `;

        listContainer.appendChild(div);
    });

    // Attach event listeners for dynamic buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const addr = e.target.dataset.addr;
            deleteAddress(addr);
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const addr = e.target.dataset.addr;
            const name = e.target.dataset.name;
            populateForm(addr, name);
        });
    });
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addAddress() {
    const rawAddr = addressInput.value.trim();
    const nickname = nicknameInput.value.trim();

    // Regex definitions
    const evmRegex = /^0x[a-fA-F0-9]{40}$/i;
    // BTC: Legacy (1...), Script (3...), Segwit (bc1...)
    const btcRegex = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,59}$/;
    // SOL: Base58, 32-44 chars
    const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

    let addrKey = rawAddr;

    // Validation & Normalization
    if (evmRegex.test(rawAddr)) {
        // EVM: Normalize to lowercase
        addrKey = rawAddr.toLowerCase();
    } else if (btcRegex.test(rawAddr)) {
        // BTC: Case sensitive
        addrKey = rawAddr;
    } else if (solRegex.test(rawAddr)) {
        // SOL: Case sensitive
        addrKey = rawAddr;
    } else {
        alert('Error: Invalid address format. Supported: EVM (0x...), Bitcoin, Solana.');
        return;
    }

    if (!nickname) {
        alert('Error: Nickname cannot be empty.');
        return;
    }

    chrome.storage.local.get(['addressMap'], (result) => {
        const map = result.addressMap || {};
        map[addrKey] = nickname;

        chrome.storage.local.set({ addressMap: map }, () => {
            // Clear form
            addressInput.value = '';
            nicknameInput.value = '';
            loadAddresses();
        });
    });
}

function deleteAddress(addr) {
    if (confirm(`Delete label for ${addr}?`)) {
        chrome.storage.local.get(['addressMap'], (result) => {
            const map = result.addressMap || {};
            delete map[addr]; // Key matches exact address (lowercase)

            chrome.storage.local.set({ addressMap: map }, () => {
                loadAddresses();
            });
        });
    }
}

function populateForm(addr, name) {
    addressInput.value = addr;
    nicknameInput.value = name;
    addressInput.focus();
}

addBtn.addEventListener('click', addAddress);

// Initialize
document.addEventListener('DOMContentLoaded', loadAddresses);
