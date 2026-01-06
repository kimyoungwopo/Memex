# Privacy Policy

**Last Updated: January 6, 2026**

Memex (the "Service") does not collect any personal information from users.

**Because we have no servers.**

---

## 1. Data Collection and Storage

This Service operates based on **"On-Device AI"** technology.

- All user data (conversations, saved memories, vector embeddings, etc.) is stored **only within the user's local browser** (IndexedDB, LocalStorage).
- The developers have no access rights or means to access this data.

---

## 2. External Data Transmission (Zero-Data Leakage)

This Service **does not transmit data to external cloud servers** such as OpenAI, Anthropic, etc. for AI inference.

| Technology | Operation Method |
|------------|------------------|
| AI Model | Chrome Built-in Gemini Nano (**Local**) |
| Embeddings | Transformers.js (**Local**) |
| Database | Orama (**Local**) |

Therefore, the Service **works perfectly even when offline** (without internet connection), which technically proves that no data is leaked externally.

---

## 3. Permission Usage

| Permission | Purpose |
|------------|---------|
| `activeTab` / `scripting` | To read text from the current page requested by the user for summarization. This data is either immediately discarded or stored only in the local DB. |
| `storage` / `unlimitedStorage` | To permanently store user's knowledge data locally. |
| `sidePanel` | To display UI in the browser's side panel. |
| `contextMenus` | To provide quick AI features through the right-click menu. |

---

## 4. Third-Party Services

This Service **does not use any third-party analytics tools, advertising networks, or tracking services.**

- Google Analytics: Not used
- Facebook Pixel: Not used
- Other tracking codes: Not used

---

## 5. Data Security

- All data is stored only in the user's local browser.
- There is no risk of man-in-the-middle (MITM) attacks as there is no data transmission over the network.
- The Service operates within the browser's security sandbox.

---

## 6. Data Deletion

Since we do not have your data, **you do not need to request data deletion.**

- **Uninstalling the extension will immediately delete all your data.**
- Alternatively, you can use the "Delete All Memories" button in settings.

---

## 7. Children's Privacy

This Service does not collect personal information from children under 13 years of age. Since we do not collect any personal information, children's personal information is also not collected.

---

## 8. Changes to Privacy Policy

This Privacy Policy may be updated in accordance with legal or service changes. We will notify you of any significant changes through in-service announcements.

---

## 9. Contact

For any inquiries, please contact us at:

**Email:** kbc01054575075@gmail.com

---

*This Privacy Policy complies with the Personal Information Protection Act of the Republic of Korea and the Information and Communications Network Act.*
