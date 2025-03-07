import { TFile, Vault, EditorPosition } from 'obsidian';

/**
 * Utility functions for working with block references and content
 */
export class BlockReferenceUtils {
    /**
     * Creates a block reference in a file
     * @param vault The Obsidian vault
     * @param file The file to create the block reference in
     * @param selectedText The selected text to create a block reference for
     * @returns The created block ID
     */
    static async createBlockReference(vault: Vault, file: TFile, selectedText: string): Promise<string> {
        try {
            // Read the file content
            const fileContent = await vault.read(file);
            
            // Find the position of the selected text
            const position = this.findTextPosition(fileContent, selectedText);
            if (!position) {
                console.error('Could not find selected text in file');
                return '';
            }
            
            // Check if the line already has a block ID
            const lines = fileContent.split('\n');
            const line = lines[position.line];
            
            // If the line already has a block ID, return it
            const existingIdMatch = line.match(/\^([a-zA-Z0-9-]+)$/);
            if (existingIdMatch) {
                return existingIdMatch[1];
            }
            
            // Generate a new block ID
            const blockId = this.generateBlockId();
            
            // Add the block ID to the line
            lines[position.line] = line + ` ^${blockId}`;
            
            // Update the file
            await vault.modify(file, lines.join('\n'));
            
            return blockId;
        } catch (error) {
            console.error('Error creating block reference:', error);
            return '';
        }
    }
    
    /**
     * Finds the position of text in a string
     * @param content The content to search in
     * @param text The text to find
     * @returns The position of the text
     */
    static findTextPosition(content: string, text: string): { line: number, offset: number } | null {
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const index = lines[i].indexOf(text);
            if (index !== -1) {
                return {
                    line: i,
                    offset: index
                };
            }
        }
        
        return null;
    }
    
    /**
     * Generates a unique block ID
     * @returns A unique block ID
     */
    static generateBlockId(): string {
        // Generate a random 6-character alphanumeric ID
        return Math.random().toString(36).substring(2, 8);
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
        // Identify task items and add properties
        return content.replace(/- \[ \]/g, '- [ ] Task: ');
    }
}
