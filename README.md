# Plugin Template

This is a template for creating plugins for [Obsidian](https://obsidian.md), maintained by [wenlzhang](https://github.com/wenlzhang).

## Getting started

1. Clone this repository to your local machine
2. Update the following files with your plugin information:
   - `manifest.json`:
     - `id`: Your plugin ID (in kebab-case)
     - `name`: Your plugin name
     - `author`: Your name
     - `authorUrl`: Your website or GitHub profile URL
     - `fundingUrl`: Optional funding information
   - `package.json`:
     - `name`: Your plugin name (should match manifest.json)
     - `description`: Your plugin description
     - `author`: Your name
     - `keywords`: Relevant keywords for your plugin

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Build the plugin:
```bash
npm run build
```

## Testing your plugin

1. Create a test vault in Obsidian
2. Create a `.obsidian/plugins` folder in your test vault
3. Copy your plugin folder into the plugins folder
4. Reload Obsidian to load the plugin (Ctrl/Cmd + R)
5. Enable the plugin in Obsidian's settings

## Publishing your plugin

1. Update `versions.json` with your plugin's version history
2. Test your plugin thoroughly
3. Create a GitHub release
4. Submit your plugin to the Obsidian Plugin Gallery

## Send to Canvas

An Obsidian plugin that allows you to send text selections, blocks, and notes to Canvas files.

## Features

- Send text selections to Canvas as plain text
- Send text selections to Canvas as block links or block embeds
- Send entire notes to Canvas as note links or note embeds
- Customize node sizes for different content types
- Append timestamps to links for tracking when content was added
- Customize open tasks when sending to Canvas

## Commands

- **Send block text**: Send the selected text (or current line) to canvas as plain text
- **Send block link**: Send the selected text (or current line) to canvas as a block link
- **Send block embed**: Send the selected text (or current line) to canvas as a block embed
- **Send note link**: Send the current note to canvas as a note link
- **Send note embed**: Send the current note to canvas as a note embed

## Settings

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

## Selection Behavior

When no text is selected and the cursor is on a line, the plugin will use the entire line as content to send to Canvas without visually selecting/highlighting the line. This allows you to quickly send content without disrupting your workflow.

## Support me

<a href='https://ko-fi.com/C0C66C1TB' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi1.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
