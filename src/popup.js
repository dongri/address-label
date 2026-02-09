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

    // Basic validation
    // 0x + 40 hex chars = 42 chars
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethRegex.test(rawAddr)) {
        alert('Error: Invalid Ethereum address format.');
        return;
    }

    if (!nickname) {
        alert('Error: Nickname cannot be empty.');
        return;
    }

    const addrKey = rawAddr.toLowerCase();

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
