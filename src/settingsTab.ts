import { App, PluginSettingTab, Setting, DropdownComponent } from 'obsidian';
import type MyPlugin from './main';
import { SendFormat } from './settings';

export class SettingsTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Send to Canvas settings' });

        new Setting(containerEl)
            .setName('Default send format')
            .setDesc('Choose the default format when sending content to canvas')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('plain', 'Plain text')
                    .addOption('link', 'Block link')
                    .addOption('embed', 'Block embed')
                    .setValue(this.plugin.settings.defaultFormat)
                    .onChange(async (value) => {
                        this.plugin.settings.defaultFormat = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Remember last canvas')
            .setDesc('Automatically select the last used canvas file in subsequent operations')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.rememberLastCanvas)
                .onChange(async (value) => {
                    this.plugin.settings.rememberLastCanvas = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include tags when sending')
            .setDesc('Include tags from the original note when sending to canvas')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeTagsInSend)
                .onChange(async (value) => {
                    this.plugin.settings.includeTagsInSend = value;
                    await this.plugin.saveSettings();
                }));
                
        new Setting(containerEl)
            .setName('Include task properties when sending')
            .setDesc('Include task properties from the original note when sending to canvas')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.includeTaskPropertiesInSend)
                .onChange(async (value) => {
                    this.plugin.settings.includeTaskPropertiesInSend = value;
                    await this.plugin.saveSettings();
                }));
    }
}
