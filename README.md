# AddressLabel - Blockchain Address Labeler

**AddressLabel** is a Chrome Extension that replaces blockchain addresses (Ethereum/EVM) with custom nicknames across the web.

## 🛡️ Privacy & Security: 100% Local & Safe

**Your privacy is our top priority.**
- **100% Local Storage**: All your data (address labels) is stored strictly within your browser's local storage (`chrome.storage.local`).
- **No External Communication**: This extension **never** sends data to any external server, API, or third-party service.
- **No Tracking**: We do not track your browsing history or collect any usage analytics.
- **Open Source**: You can inspect the code to verify that no data ever leaves your machine.

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked**.
5. Select the `address-label/src` directory.

## Usage

1. **Add a Label**:
   - **Method A**: Click the extension icon to open the manager and add addresses manually.
   - **Method B**: Select any `0x...` address on a web page with your mouse. An "Add Label" popup will appear. Enter a nickname and save.

2. **View Labels**:
   - The addresses on the page will be replaced by the nickname (e.g., `My Main Wallet`).
   - Hover over the nickname to see the original address.

3. **Edit/Delete**:
   - Open the extension popup to edit or delete saved labels.

## Structure

- `manifest.json`: Extension configuration (Manifest V3).
- `content.js`: Main logic for scanning DOM and replacing text.
- `content.css`: Styles for the replaced labels and the selection popup.
- `popup.html` & `popup.js`: Management UI.
