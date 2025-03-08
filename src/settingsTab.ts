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

        // Add a heading for the startup delay section
        new Setting(containerEl).setName("Canvas file loading").setHeading();

        // Add explanation about the startup delay
        const delayInfo = containerEl.createDiv("canvas-delay-info");
        delayInfo.createEl("p", {
            text: "The plugin needs time to find canvas files after Obsidian starts. If you have a large vault or if the plugin has trouble finding your canvas files after restart, try increasing this delay.",
        });

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

        // Add a heading for the block ID format section
        new Setting(containerEl).setName("Block ID format").setHeading();

        // Add explanation about block ID format
        const blockIdInfo = containerEl.createDiv("block-id-format-info");
        blockIdInfo.createEl("p", {
            text: "You can customize the format of block IDs created when sending content to canvas. By default, random alphanumeric IDs are used.",
        });

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

            // Add examples of moment.js formats
            const formatExamples = containerEl.createDiv(
                "block-id-format-examples",
            );
            formatExamples.createEl("p", {
                text: "Examples:",
                cls: "block-id-format-examples-title",
            });

            const examplesList = formatExamples.createEl("ul");

            const addExample = (format: string, description: string) => {
                const item = examplesList.createEl("li");
                item.createEl("code", { text: format });
                item.createSpan({ text: ` - ${description}` });
            };

            addExample("YYYYMMDDHHmmss", "20250308120000 (basic timestamp)");
            addExample(
                "YYYY-MM-DDTHH-mm-ss",
                "2025-03-08T12-00-00 (with date separators)",
            );
            addExample("YYMMDD-HHmm", "250308-1200 (shorter format)");
            addExample(
                "YYYYMMDDHHmmssSSS",
                "20250308120000123 (with milliseconds)",
            );
        }
    }
}
