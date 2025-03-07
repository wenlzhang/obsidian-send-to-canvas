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

        // Create preset buttons
        createPresetButton("5s", 5000);
        createPresetButton("10s", 10000);
        createPresetButton("30s", 30000);
        createPresetButton("1m", 60000);
        createPresetButton("2m", 120000);
        createPresetButton("5m", 300000);
        createPresetButton("10m", 600000);

        new Setting(containerEl)
            .setName("Startup load delay")
            .setDesc(
                "Adjust how long the plugin waits before trying to find canvas files after Obsidian starts.",
            )
            .addSlider((slider) =>
                slider
                    .setLimits(1000, 600000, 1000)
                    .setValue(this.plugin.settings.startupLoadDelay)
                    .setDynamicTooltip()
                    .onChange(async (value) => {
                        this.plugin.settings.startupLoadDelay = value;
                        await this.plugin.saveSettings();
                    }),
            )
            .addExtraButton((button) =>
                button
                    .setIcon("reset")
                    .setTooltip("Reset to default (5000ms)")
                    .onClick(async () => {
                        this.plugin.settings.startupLoadDelay = 5000;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh the display
                    }),
            )
            .addText((text) => {
                // Update the text field with the current value in a readable format
                const updateDisplayValue = (value: number) => {
                    if (value < 60000) {
                        // Less than a minute, show in seconds
                        text.setValue(`${(value / 1000).toFixed(1)} seconds`);
                    } else {
                        // More than a minute, show in minutes and seconds
                        const minutes = Math.floor(value / 60000);
                        const seconds = ((value % 60000) / 1000).toFixed(0);
                        text.setValue(`${minutes} min ${seconds} sec`);
                    }
                };

                // Set initial value
                updateDisplayValue(this.plugin.settings.startupLoadDelay);

                // Update when slider changes
                slider.onChange((value) => {
                    updateDisplayValue(value);
                });

                // Make the text field smaller and read-only
                text.inputEl.style.width = "100px";
                text.setDisabled(true);
            });
    }
}
