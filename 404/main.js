'use strict';

class OutlineItemNode {
    constructor(data) {
        this.url = data.url;
        this.text = data.text || '';
        this.childrenUrls = data.children || [];
        this.children = [];
        this.element = null;
        this.input = null;
        this.lastServerText = this.text;
    }

    async load() {
        return fetch(this.url)
            .then(response => response.json())
            .then(data => {
                this.url = data.url;
                this.text = data.text || '';
                this.childrenUrls = data.children || [];
                this.lastServerText = this.text;
                return this;
            });
    }

    createElement() {
        const div = document.createElement('div');
        div.className = 'outline-item';
        div.dataset.url = this.url;

        const content = document.createElement('div');
        content.className = 'outline-item-content';

        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.text;
        input.placeholder = 'Enter item text...';
        this.input = input;

        // Handle input changes
        let updateTimeout = null;
        input.addEventListener('input', (e) => {
            this.text = e.target.value;
            // Debounce updates to backend
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
                this.updateToBackend();
            }, 1000);
        });

        const buttons = document.createElement('div');
        buttons.className = 'outline-buttons';

        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.className = 'add-btn';
        addButton.addEventListener('click', () => {
            this.addChild();
        });

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.className = 'delete-btn';
        deleteButton.addEventListener('click', () => {
            this.delete();
        });

        buttons.appendChild(addButton);
        buttons.appendChild(deleteButton);

        content.appendChild(input);
        content.appendChild(buttons);

        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'outline-children';

        div.appendChild(content);
        div.appendChild(childrenDiv);

        this.element = div;
        return div;
    }

    async updateToBackend() {
        if (this.text === this.lastServerText) {
            return;
        }

        try {
            await fetch(this.url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: this.text })
            });
            this.lastServerText = this.text;
        } catch (error) {
            console.error('Error updating item:', error);
        }
    }

    async addChild() {
        try {
            const response = await fetch(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: 'New Item' })
            });

            if (response.ok) {
                // Reload current node to get updated children list
                await this.load();
                // Then load all children
                await this.loadChildren();
            }
        } catch (error) {
            console.error('Error adding child:', error);
        }
    }

    async delete() {
        if (this.url === '/outline/') {
            alert('Cannot delete root item');
            return;
        }

        try {
            const response = await fetch(this.url, {
                method: 'DELETE'
            });

            if (response.ok || response.status === 204) {
                if (this.element && this.element.parentNode) {
                    this.element.remove();
                }
            }
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    }

    async loadChildren() {
        const childrenDiv = this.element.querySelector('.outline-children');
        
        const existingUrls = this.children.map(c => c.url);
        
        const newUrls = this.childrenUrls.filter(url => !existingUrls.includes(url));
        
        // Add only new children
        for (const childUrl of newUrls) {
            const child = new OutlineItemNode({ url: childUrl });
            await child.load();
            child.createElement();
            childrenDiv.appendChild(child.element);
            this.children.push(child);
        }
        
        // Remove deleted children
        const deletedUrls = existingUrls.filter(url => !this.childrenUrls.includes(url));
        for (const deletedUrl of deletedUrls) {
            const deletedChild = this.children.find(c => c.url === deletedUrl);
            if (deletedChild && deletedChild.element && deletedChild.element.parentNode) {
                deletedChild.element.remove();
                this.children = this.children.filter(c => c.url !== deletedUrl);
            }
        }
    }

    updateFromServer() {
        if (this.input) {
            const currentValue = this.input.value;
            if (this.text !== this.lastServerText && currentValue === this.lastServerText) {
                // User is not currently editing, update from server
                this.input.value = this.text;
                this.lastServerText = this.text;
            }
        }
    }
}

class OutlineEditor {
    constructor() {
        this.root = null;
        this.container = null;
        this.lastPollTime = 0;
        this.pollingInProgress = false;
        this.inFlightRequests = new Map();
    }

    init() {
        const body = document.body;
        const h1 = body.querySelector('h1');
        if (h1) {
            h1.remove();
        }

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'outline-container';
        body.appendChild(this.container);

        // Load and display outline
        this.loadOutline();

        // Start polling
        this.startPolling();
    }

    async loadOutline() {
        try {
            const rootNode = new OutlineItemNode({ url: '/outline/' });
            await rootNode.load();
            rootNode.createElement();
            
            this.container.appendChild(rootNode.element);
            this.root = rootNode;

            await this.loadAllChildren(rootNode);
        } catch (error) {
            console.error('Error loading outline:', error);
            this.container.innerHTML = '<p>Error loading outline</p>';
        }
    }

    async loadAllChildren(node) {
        await node.loadChildren();
        for (const child of node.children) {
            await this.loadAllChildren(child);
        }
    }

    startPolling() {
        setInterval(() => {
            this.pollForUpdates();
        }, 2000);
    }

    async pollForUpdates() {
        if (this.pollingInProgress) {
            return;
        }

        this.pollingInProgress = true;

        try {
            const response = await fetch(`/updates/?since=${this.lastPollTime}`);
            const data = await response.json();
            
            // Update last poll time
            this.lastPollTime = Date.now() / 1000;

            // Load updated items
            for (const url of data.updated) {
                await this.updateItem(url);
            }
        } catch (error) {
            console.error('Error polling for updates:', error);
        } finally {
            this.pollingInProgress = false;
        }
    }

    async updateItem(url) {
        if (this.inFlightRequests.has(url)) {
            return this.inFlightRequests.get(url);
        }

        const promise = fetch(url)
            .then(response => response.json())
            .then(data => {
                const node = this.findNodeByUrl(url);
                if (node) {
                    node.text = data.text;
                    node.childrenUrls = data.children;
                    node.updateFromServer();
                    
                    // If children changed, reload them
                    const currentChildrenUrls = node.children.map(c => c.url).join(',');
                    const newChildrenUrls = node.childrenUrls.join(',');
                    if (currentChildrenUrls !== newChildrenUrls) {
                        node.loadChildren().then(() => {
                            // Recursively load all children of newly added items only
                            const existingUrls = currentChildrenUrls.split(',').filter(url => url);
                            for (const child of node.children) {
                                if (!existingUrls.includes(child.url)) {
                                    // Only load all children for newly added items
                                    this.loadAllChildren(child);
                                }
                            }
                        });
                    }
                }
            })
            .catch(error => {
                console.error('Error updating item:', error);
            })
            .finally(() => {
                this.inFlightRequests.delete(url);
            });

        this.inFlightRequests.set(url, promise);
        return promise;
    }

    findNodeByUrl(url, node = null) {
        if (!node) {
            node = this.root;
        }

        if (!node) {
            return null;
        }

        if (node.url === url) {
            return node;
        }

        for (const child of node.children) {
            const found = this.findNodeByUrl(url, child);
            if (found) {
                return found;
            }
        }

        return null;
    }
}

// Initialize the editor when the page loads
window.addEventListener('load', () => {
    const editor = new OutlineEditor();
    editor.init();
});
