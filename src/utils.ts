import { TFile, Vault, EditorPosition, moment } from "obsidian";
import { SendToCanvasSettings } from "./settings";

/**
 * Utility functions for working with block references and content
 */
export class BlockReferenceUtils {
    /**
     * Creates a block reference in a file
     * @param vault The Obsidian vault
     * @param file The file to create the block reference in
     * @param selectedText The selected text to create a block reference for
     * @param settings Plugin settings
     * @returns The created block ID
     */
    static async createBlockReference(
        vault: Vault,
        file: TFile,
        selectedText: string,
        settings: SendToCanvasSettings,
    ): Promise<string> {
        try {
            // Read the file content
            const fileContent = await vault.read(file);

            // Find the position of the selected text
            const position = this.findTextPosition(fileContent, selectedText);
            if (!position) {
                console.error("Could not find selected text in file");
                return "";
            }

            // Check if the line already has a block ID
            const lines = fileContent.split("\n");
            const line = lines[position.line];

            // If the line already has a block ID, return it
            const existingIdMatch = line.match(/\^([a-zA-Z0-9-]+)$/);
            if (existingIdMatch) {
                return existingIdMatch[1];
            }

            // Generate a new block ID
            const blockId = this.generateBlockId(settings);

            // Add the block ID to the line
            lines[position.line] = line + ` ^${blockId}`;

            // Update the file
            await vault.process(file, (data) => lines.join("\n"));

            return blockId;
        } catch (error) {
            console.error("Error creating block reference:", error);
            return "";
        }
    }

    /**
     * Finds the position of text in a string
     * @param content The content to search in
     * @param text The text to find
     * @returns The position of the text
     */
    static findTextPosition(
        content: string,
        text: string,
    ): { line: number; offset: number } | null {
        const lines = content.split("\n");
        const searchText = text.trim();

        // First try exact match in a single line
        for (let i = 0; i < lines.length; i++) {
            const index = lines[i].indexOf(text);
            if (index !== -1) {
                return {
                    line: i,
                    offset: index,
                };
            }
        }

        // Try exact match with trimmed text
        for (let i = 0; i < lines.length; i++) {
            const index = lines[i].indexOf(searchText);
            if (index !== -1) {
                return {
                    line: i,
                    offset: index,
                };
            }
        }

        // If not found, try more flexible matching for task items
        if (searchText.startsWith("- [ ]")) {
            const taskPrefix = "- [ ]";
            const taskContent = searchText.substring(taskPrefix.length).trim();

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line.startsWith(taskPrefix) && line.includes(taskContent)) {
                    return {
                        line: i,
                        offset: lines[i].indexOf(taskPrefix),
                    };
                }
            }
        }

        // If not found, try to match first line for multi-line selections
        if (text.includes("\n")) {
            const firstLine = text.split("\n")[0].trim();
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === firstLine) {
                    return {
                        line: i,
                        offset: lines[i].indexOf(firstLine.charAt(0)),
                    };
                }
            }
        }

        // Last resort: try matching with whitespace normalization
        for (let i = 0; i < lines.length; i++) {
            const normalizedLine = lines[i].replace(/\s+/g, " ").trim();
            const normalizedText = searchText.replace(/\s+/g, " ").trim();

            if (normalizedLine === normalizedText) {
                return {
                    line: i,
                    offset: 0,
                };
            }
        }

        return null;
    }

    /**
     * Generates a block ID based on settings
     * @param settings Plugin settings
     * @returns A block ID string
     */
    static generateBlockId(settings: SendToCanvasSettings): string {
        if (settings.useCustomBlockIdFormat) {
            // Use moment.js to generate a date-based ID
            return moment().format(settings.blockIdDateFormat);
        } else {
            // Generate a random 6-character alphanumeric ID (original method)
            return Math.random().toString(36).substring(2, 8);
        }
    }

    /**
     * Extracts tags from content
     * @param content The content to extract tags from
     * @returns Array of tags
     */
    static extractTags(content: string): string[] {
        const tagRegex = /#[a-zA-Z0-9_-]+/g;
        return content.match(tagRegex) || [];
    }

    /**
     * Processes task properties in content
     * @param content The content to process
     * @returns Processed content with task properties
     */
    static processTaskProperties(content: string): string {
        // Return the original content without modification
        return content;
    }
}
