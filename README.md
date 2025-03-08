# Send to Canvas

An Obsidian plugin that allows you to send text selections, blocks, and notes to Canvas files.

## Features

- **Multiple content formats**:
  - Send text as plain text
  - Send text as block links
  - Send text as block embeds
  - Send entire notes as note links
  - Send entire notes as note embeds
- **Block ID customization**:
  - Use date-based or random block IDs
  - Customize block ID format using MomentJS tokens
- **Open task customization**:
  - Append custom text to open tasks (lines starting with "- [ ]")
  - Preserve original task formatting
- **Timestamp tracking**:
  - Append timestamps to links and embeds
  - Customize timestamp format
- **Canvas node customization**:
  - Set custom sizes for different node types (links, content, notes)
  - Consistent sizing between block embeds and text content
- **User experience**:
  - Remember last selected canvas file
  - Status bar indicator showing current canvas
  - Customizable startup delay for large vaults
- **Smart text selection**: Automatically uses the entire line when no text is selected

## Commands

- **Send block text**: Send the selected text (or current line) to canvas as plain text
- **Send block link**: Send the selected text (or current line) to canvas as a block link
- **Send block embed**: Send the selected text (or current line) to canvas as a block embed
- **Send note link**: Send the current note to canvas as a note link
- **Send note embed**: Send the current note to canvas as a note embed

## Usage

### Getting Started

1. Install the plugin from the Obsidian Community Plugins browser
2. Enable the plugin in Obsidian settings
3. Open a canvas file that you want to send content to
4. Use the command palette (Ctrl/Cmd+P) to select "Send to Canvas: Select Canvas File"
5. Choose your canvas file from the dropdown

### Sending Content to Canvas

1. Select text in a note or place your cursor on a line (no selection needed)
2. Open the command palette (Ctrl/Cmd+P)
3. Choose one of the "Send to Canvas" commands:
   - "Send block text" for plain text
   - "Send block link" for a link to the block
   - "Send block embed" to embed the block
   - "Send note link" for a link to the current note
   - "Send note embed" to embed the current note
4. The content will be added to your selected canvas file

### Keyboard Shortcuts

You can set up keyboard shortcuts for any of the commands in Obsidian's Hotkeys settings.

## Settings

### Canvas Selection

- **Default send format**: Choose the default format (plain text, block link, or block embed) when sending content to canvas
- **Remember last canvas**: Automatically select the last used canvas file when Obsidian restarts

### Block ID Format

You can customize the format of block IDs using MomentJS formatting tokens. Here are some examples:

- `YYYYMMDDHHmmss` → 20250308120000 (basic timestamp)
- `YYYY-MM-DDTHH-mm-ss` → 2025-03-08T12-00-00 (with date separators)
- `YYMMDD-HHmm` → 250308-1200 (shorter format)
- `YYYYMMDDHHmmssSSS` → 20250308120000123 (with milliseconds)

### Timestamp Format

When appending timestamps to links, you can customize the format using MomentJS formatting tokens. Here are some examples:

- `[📝 ]YYYY-MM-DDTHH:mm` → 📝 2025-03-08T08:07 (with emoji)
- `[(]YYYY-MM-DD[)]` → (2025-03-08) (with parentheses)
- `[Added: ]HH:mm` → Added: 08:07 (with text prefix)
- `[on ]dddd[, ]MMMM Do` → on Saturday, March 8th (with day name)

### Open Task Customization

You can append custom text to open tasks (lines starting with "- [ ]") when sending them to Canvas. This is useful for adding tags, metadata, or other information to tasks.

Example:
- Original: `- [ ] Task description`
- Modified: `- [ ] Task description [l:: #Canvas ]`

### Canvas Node Sizes

You can customize the dimensions of nodes created in canvas files:
- **Link nodes**: For note links and block links (default: 400×100)
- **Content nodes**: For block embeds and plain text (default: 400×200)
- **File nodes**: For note content (default: 400×400)

### Canvas File Loading

The plugin needs time to find canvas files after Obsidian starts. If you have a large vault or if the plugin has trouble finding your canvas files after restart, you can increase the startup delay.

## Installation

1. Open Obsidian Settings
2. Go to Community Plugins and disable Safe Mode
3. Click Browse and search for "Send to Canvas"
4. Install the plugin and enable it

## Manual Installation

1. Download the latest release from the [GitHub releases page](https://github.com/wenlzhang/obsidian-send-to-canvas/releases)
2. Extract the files to your Obsidian plugins folder: `.obsidian/plugins/obsidian-send-to-canvas/`
3. Reload Obsidian
4. Enable the plugin in Obsidian settings

## Support me

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
