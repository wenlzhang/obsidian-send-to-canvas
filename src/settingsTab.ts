import { App, PluginSettingTab, Setting } from "obsidian";
import { SendFormat } from "./settings";
import Main from "./main";

export class SettingsTab extends PluginSettingTab {
    plugin: Main;

    constructor(app: App, plugin: Main) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Canvas selection section
        new Setting(containerEl).setName("Canvas selection").setHeading();

        new Setting(containerEl)
            .setName("Default send format")
            .setDesc("Choose the default format when sending content to canvas")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("plain", "Plain text")
                    .addOption("link", "Block link")
                    .addOption("embed", "Block embed")
                    .setValue(this.plugin.settings.defaultFormat)
                    .onChange(async (value: SendFormat) => {
                        this.plugin.settings.defaultFormat = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Remember last canvas")
            .setDesc(
                "Remember the last selected canvas file when Obsidian restarts",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.rememberLastCanvas)
                    .onChange(async (value) => {
                        this.plugin.settings.rememberLastCanvas = value;
                        // Don't clear the lastCanvasPath when toggling off
                        // This allows the user to toggle it back on and have the last canvas still selected
                        await this.plugin.saveSettings();
                    }),
            );

        // Open task customization section
        new Setting(containerEl)
            .setName("Open task customization")
            .setDesc(
                "Customize how open tasks (lines starting with '- [ ]') are sent to canvas. You can append custom text like tags or metadata to tasks.",
            )
            .setHeading();

        new Setting(containerEl)
            .setName("Append text to open tasks")
            .setDesc(
                "Add custom text to open tasks (lines starting with '- [ ]') before creating block IDs",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.appendTextToOpenTasks)
                    .onChange(async (value) => {
                        this.plugin.settings.appendTextToOpenTasks = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the display to show/hide the custom text settings
                    }),
            );
        // Only show the custom text settings if append text to open tasks is enabled
        if (this.plugin.settings.appendTextToOpenTasks) {
            new Setting(containerEl)
                .setName("Text to append")
                .setDesc(
                    "Custom text to append to open tasks before the block ID",
                )
                .addText((text) =>
                    text
                        .setValue(this.plugin.settings.openTaskAppendText)
                        .onChange(async (value) => {
                            this.plugin.settings.openTaskAppendText = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // Add a heading for the block ID format section with description
        new Setting(containerEl)
            .setName("Block ID format")
            .setDesc(
                "You can customize the format of block IDs created when sending content to canvas. By default, random alphanumeric IDs are used.",
            )
            .setHeading();

        // Add toggle for using custom block ID format
        new Setting(containerEl)
            .setName("Use date-based block IDs")
            .setDesc(
                "Use a date-based format for block IDs instead of random characters",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.useCustomBlockIdFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.useCustomBlockIdFormat = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the display to show/hide the format setting
                    }),
            );

        // Only show the format setting if custom format is enabled
        if (this.plugin.settings.useCustomBlockIdFormat) {
            new Setting(containerEl)
                .setName("Block ID format")
                .setDesc(
                    "MomentJS format for generating block IDs (e.g., YYYYMMDDHHmmss)",
                )
                .addText((text) =>
                    text
                        .setPlaceholder("YYYYMMDDHHmmss")
                        .setValue(this.plugin.settings.blockIdDateFormat)
                        .onChange(async (value) => {
                            this.plugin.settings.blockIdDateFormat = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // Add a heading for the timestamp append section with description
        new Setting(containerEl)
            .setName("Link timestamp")
            .setDesc(
                "You can append a timestamp after links and embeds sent to canvas. This helps track when content was added to the canvas.",
            )
            .setHeading();

        // Add toggle for appending timestamp to links
        new Setting(containerEl)
            .setName("Append timestamp to links")
            .setDesc(
                "Add a timestamp after block links, block embeds, and note links (not applied to plain text)",
            )
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.appendTimestampToLinks)
                    .onChange(async (value) => {
                        this.plugin.settings.appendTimestampToLinks = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the display to show/hide the format setting
                    }),
            );

        // Only show the format setting if timestamp append is enabled
        if (this.plugin.settings.appendTimestampToLinks) {
            new Setting(containerEl)
                .setName("Timestamp format")
                .setDesc(
                    "MomentJS format for the timestamp to append after links",
                )
                .addText((text) =>
                    text
                        .setPlaceholder("[📝 ]YYYY-MM-DDTHH:mm")
                        .setValue(this.plugin.settings.appendTimestampFormat)
                        .onChange(async (value) => {
                            this.plugin.settings.appendTimestampFormat = value;
                            await this.plugin.saveSettings();
                        }),
                );
        }

        // Node size settings section
        new Setting(containerEl)
            .setName("Canvas node sizes")
            .setDesc(
                "Customize the dimensions of nodes created in canvas files. Default sizes are 400×100 for links, 400×200 for content, and 400×400 for note content.",
            )
            .setHeading();

        // Link and block link node size settings
        new Setting(containerEl)
            .setName("Link nodes (note links and block links)")
            .setDesc("Configure size settings for note links and block links");

        new Setting(containerEl)
            .setName("Link node width")
            .setDesc("Width of nodes for note links and block links")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.linkNodeWidth.toString())
                    .onChange(async (value) => {
                        const width = parseInt(value);
                        if (!isNaN(width) && width > 0) {
                            this.plugin.settings.linkNodeWidth = width;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("Link node height")
            .setDesc("Height of nodes for note links and block links")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.linkNodeHeight.toString())
                    .onChange(async (value) => {
                        const height = parseInt(value);
                        if (!isNaN(height) && height > 0) {
                            this.plugin.settings.linkNodeHeight = height;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        // Content node size settings (block embeds and plain text)
        new Setting(containerEl)
            .setName("Content nodes (block embeds and plain text)")
            .setDesc("Configure size settings for block embeds and plain text");

        new Setting(containerEl)
            .setName("Content node width")
            .setDesc("Width of nodes for block embeds and plain text")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.contentNodeWidth.toString())
                    .onChange(async (value) => {
                        const width = parseInt(value);
                        if (!isNaN(width) && width > 0) {
                            this.plugin.settings.contentNodeWidth = width;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("Content node height")
            .setDesc("Height of nodes for block embeds and plain text")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.contentNodeHeight.toString())
                    .onChange(async (value) => {
                        const height = parseInt(value);
                        if (!isNaN(height) && height > 0) {
                            this.plugin.settings.contentNodeHeight = height;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        // File node size settings (note content)
        new Setting(containerEl)
            .setName("File nodes (note content)")
            .setDesc("Configure size settings for note content");

        new Setting(containerEl)
            .setName("File node width")
            .setDesc("Width of nodes for note content")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.fileNodeWidth.toString())
                    .onChange(async (value) => {
                        const width = parseInt(value);
                        if (!isNaN(width) && width > 0) {
                            this.plugin.settings.fileNodeWidth = width;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        new Setting(containerEl)
            .setName("File node height")
            .setDesc("Height of nodes for note content")
            .addText((text) =>
                text
                    .setValue(this.plugin.settings.fileNodeHeight.toString())
                    .onChange(async (value) => {
                        const height = parseInt(value);
                        if (!isNaN(height) && height > 0) {
                            this.plugin.settings.fileNodeHeight = height;
                            await this.plugin.saveSettings();
                        }
                    }),
            );

        // Add a heading for the startup delay section with description
        new Setting(containerEl)
            .setName("Canvas file loading")
            .setDesc(
                "The plugin needs time to find canvas files after Obsidian starts. If you have a large vault or if the plugin has trouble finding your canvas files after restart, try increasing this delay.",
            )
            .setHeading();

        // Create a container for the preset buttons
        const presetContainer = containerEl.createDiv("canvas-delay-presets");
        presetContainer.createEl("span", { text: "Presets: " });

        // Helper function to create preset buttons
        const createPresetButton = (label: string, value: number) => {
            const btn = presetContainer.createEl("button", { text: label });
            btn.addEventListener("click", async () => {
                this.plugin.settings.startupLoadDelay = value;
                await this.plugin.saveSettings();
                this.display(); // Refresh the display
            });
        };

        // Create preset buttons for seconds and minutes
        createPresetButton("5s", 5);
        createPresetButton("10s", 10);
        createPresetButton("30s", 30);
        createPresetButton("1m", 60);
        createPresetButton("2m", 120);
        createPresetButton("5m", 300);
        createPresetButton("10m", 600);

        // Create a setting with a slider and display of the current value
        const delaySlider = new Setting(containerEl)
            .setName("Startup load delay")
            .setDesc(
                "Adjust how long the plugin waits before trying to find canvas files after Obsidian starts.",
            )
            .addSlider((slider) => {
                slider
                    .setLimits(1, 600, 1) // 1 second to 10 minutes
                    .setValue(this.plugin.settings.startupLoadDelay)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.startupLoadDelay = value;
                        await this.plugin.saveSettings();

                        // Update the name to show the current value
                        updateSliderName(value);
                    });
                return slider;
            })
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip("Reset to default (5 seconds)")
                    .onClick(async () => {
                        this.plugin.settings.startupLoadDelay = 5;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the display
                    }),
            );

        // Function to update the slider name with the current value
        const updateSliderName = (value: number) => {
            let displayValue: string;
            if (value < 60) {
                // Less than a minute, show in seconds
                displayValue = `${value} seconds`;
            } else {
                // More than a minute, show in minutes and seconds
                const minutes = Math.floor(value / 60);
                const seconds = value % 60;
                if (seconds === 0) {
                    displayValue = `${minutes} minute${minutes > 1 ? "s" : ""}`;
                } else {
                    displayValue = `${minutes} minute${minutes > 1 ? "s" : ""} ${seconds} second${seconds > 1 ? "s" : ""}`;
                }
            }
            delaySlider.setName(`Startup load delay (${displayValue})`);
        };

        // Initialize the slider name
        updateSliderName(this.plugin.settings.startupLoadDelay);
    }
}
