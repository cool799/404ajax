[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/y1IucnE_)
# labsignment-flask-ajax

## CMPUT 404 Flask and AJAX Lab

A live collaborative outline editor built with Flask and vanilla JavaScript.

### Features

- Create, edit, and delete outline items
- Nested hierarchical structure
- Real-time collaborative editing with polling
- Modern, responsive UI

### Getting Started

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the Flask server:
```bash
flask --app outliner run --host 0.0.0.0 --debug
```

3. Open your browser and navigate to:
```
http://localhost:5001
```

**Note:** If port 5000 is already in use (e.g., by macOS AirPlay Receiver), the server will run on port 5001 instead.

### Project Structure

- `outliner.py` - Flask backend with API endpoints
- `main.js` - Frontend JavaScript for UI and AJAX calls
- `style.css` - Styling for the outline editor
- `ui.html` - Main HTML template (served by Flask)

### API Endpoints

- `GET /outline/` - Get root item
- `GET /outline/<path>/` - Get specific item
- `POST /outline/<path>/` - Create new child item
- `PUT /outline/<path>/` - Update item text
- `DELETE /outline/<path>/` - Delete item and children
- `GET /updates/?since=<timestamp>` - Get updated items since timestamp

### Citation

Debugging from: Chat-gpt 5o, 2025-10-26-18:49, https://chatgpt.com/c/68febcfc-a0c4-8321-8cb2-130e7b373175