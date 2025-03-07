import { App, PluginSettingTab, Setting, DropdownComponent } from "obsidian";
import type Main from "./main";
import { SendFormat } from "./settings";

export class SettingsTab extends PluginSettingTab {
    plugin: Main;

    constructor(app: App, plugin: Main) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl("h2", { text: "Send to canvas settings" });

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

        new Setting(containerEl)
            .setName("Include tags in send")
            .setDesc("Include tags when sending text to canvas")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.includeTagsInSend)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTagsInSend = value;
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName("Include task properties in send")
            .setDesc("Include task properties when sending tasks to canvas")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.includeTaskPropertiesInSend)
                    .onChange(async (value) => {
                        this.plugin.settings.includeTaskPropertiesInSend =
                            value;
                        await this.plugin.saveSettings();
                    }),
            );

        // Add a heading for the startup delay section
        containerEl.createEl("h3", { text: "Canvas file loading" });

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
    }
}
