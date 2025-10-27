#!/usr/bin/env python3

from flask import Flask, Response, jsonify, request
import json
import time
from datetime import datetime

app = Flask(__name__)


class OutlineItem:
    """Represents an item in the outline"""
    def __init__(self, url, text=""):
        self.url = url
        self.text = text
        self.children = []
        self.last_modified = time.time()
    
    def to_dict(self):
        """Convert to dictionary for json serialization"""
        return {
            "url": self.url,
            "text": self.text,
            "children": [child.url for child in self.children]
        }
    
    def add_child(self, child):
        self.children.append(child)
        self.last_modified = time.time()
    
    def remove_child(self, child):
        if child in self.children:
            self.children.remove(child)
            self.last_modified = time.time()
            return True
        return False


class OutlineModel:
    """Model for the outline"""
    def __init__(self):
        self.root = OutlineItem("/outline/")
        self.root.text = "My Outline"
        self.item_count = 0
        self.all_items = {"/outline/": self.root}
        self.updated_items = set()
    
    def get_item(self, path):
        return self.all_items.get(path)
    
    def create_item(self, parent_path, text=""):
        parent = self.get_item(parent_path)
        if parent is None:
            return None
        
        # Create new item with unique URL
        new_url = f"{parent_path}{len(parent.children)}/"
        self.item_count += 1
        
        new_item = OutlineItem(new_url, text)
        parent.add_child(new_item)
        self.all_items[new_url] = new_item
        self.updated_items.add(new_url)
        self.updated_items.add(parent_path)
        
        return new_item
    
    def update_item(self, path, text):
        item = self.get_item(path)
        if item is None:
            return None
        
        item.text = text
        item.last_modified = time.time()
        self.updated_items.add(path)
        return item
    
    def delete_item(self, path):
        if path == "/outline/":
            return False  # Cannot delete root
        
        item = self.get_item(path)
        if item is None:
            return False
        
        # Recursively delete children
        for child in list(item.children):
            self.delete_item(child.url)
        
        # Find parent and remove from parent's children
        parent_path = "/".join(path.split("/")[:-2]) + "/"
        parent = self.get_item(parent_path)
        if parent:
            parent.remove_child(item)
        
        # Remove from all_items
        del self.all_items[path]
        self.updated_items.add(parent_path)
        
        return True
    
    def get_updated_items(self, since):
        """Get list of items updated since timestamp"""
        updated = []
        current_time = time.time()
        
        # Only return items that were actually updated since the given timestamp
        for url in list(self.updated_items):
            item = self.get_item(url)
            if item and item.last_modified > since:
                updated.append(url)
        
        # Clean up old update records (older than 1 hour) to prevent memory leaks
        self.cleanup_old_updates(current_time - 3600)
        
        return updated
    
    def cleanup_old_updates(self, cutoff_time):
        """Clean up old update records to prevent memory leaks"""
        to_remove = []
        for url in self.updated_items:
            item = self.get_item(url)
            if item and item.last_modified < cutoff_time:
                to_remove.append(url)
        
        for url in to_remove:
            self.updated_items.discard(url)
    
    def clear_updated_items(self):
        """Clear the list of updated items (kept for compatibility)"""
        self.updated_items.clear()


# Global model instance
model = OutlineModel()


@app.route('/')
def index():
    try:
        with open('ui.html', 'r') as f:
            html_content = f.read()
        return Response(html_content, mimetype='text/html')
    except FileNotFoundError:
        return "ui.html not found", 404


@app.route('/style.css')
def style():
    try:
        with open('style.css', 'r') as f:
            css_content = f.read()
        return Response(css_content, mimetype='text/css')
    except FileNotFoundError:
        return "style.css not found", 404


@app.route('/main.js')
def main_js():
    try:
        with open('main.js', 'r') as f:
            js_content = f.read()
        return Response(js_content, mimetype='application/javascript')
    except FileNotFoundError:
        return "main.js not found", 404


@app.route('/favicon.ico')
def favicon():
    """Serve the favicon"""
    try:
        with open('favicon.ico', 'rb') as f:
            icon_bytes = f.read()
        return Response(icon_bytes, mimetype='image/x-icon')
    except FileNotFoundError:
        return "favicon.ico not found", 404


@app.route('/outline/', methods=['GET', 'POST'])
def handle_root():
    """Get or create items in the root"""
    if request.method == 'GET':
        return jsonify(model.root.to_dict())
    else:  # POST
        data = request.json if request.json else {}
        text = data.get('text', '')
        
        new_item = model.create_item('/outline/', text)
        
        if new_item is None:
            return jsonify({"error": "Parent not found"}), 404
        
        return jsonify(new_item.to_dict()), 201


@app.route('/outline/<path:item_path>/', methods=['GET'])
def get_item(item_path):
    url = f"/outline/{item_path}/"
    item = model.get_item(url)
    
    if item is None:
        return jsonify({"error": "Item not found"}), 404
    
    return jsonify(item.to_dict())


@app.route('/outline/<path:item_path>/', methods=['POST'])
def create_item(item_path):
    url = f"/outline/{item_path}/"
    
    data = request.json if request.json else {}
    text = data.get('text', '')
    
    new_item = model.create_item(url, text)
    
    if new_item is None:
        return jsonify({"error": "Parent not found"}), 404
    
    return jsonify(new_item.to_dict()), 201


@app.route('/outline/<path:item_path>/', methods=['PUT'])
def update_item(item_path):
    url = f"/outline/{item_path}/"
    
    data = request.json if request.json else {}
    text = data.get('text', '')
    
    updated_item = model.update_item(url, text)
    
    if updated_item is None:
        return jsonify({"error": "Item not found"}), 404
    
    return jsonify(updated_item.to_dict())


@app.route('/outline/<path:item_path>/', methods=['DELETE'])
def delete_item(item_path):
    url = f"/outline/{item_path}/"
    
    if model.delete_item(url):
        return '', 204
    else:
        return jsonify({"error": "Item not found"}), 404


@app.route('/updates/', methods=['GET'])
def get_updates():
    """Get list of updated items since a timestamp"""
    since = float(request.args.get('since', 0))
    updated = model.get_updated_items(since)
    # Don't clear updated_items - let them persist for other clients
    return jsonify({"updated": updated})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
