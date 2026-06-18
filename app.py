from flask import Flask, jsonify, render_template, request
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import time
import os
import json

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "feed_cache.json"
CACHE_DURATION = 900  # 15 minutes in seconds

def get_parsed_feed(force_refresh=False):
    # Check if cache exists and is valid
    if not force_refresh and os.path.exists(CACHE_FILE):
        file_mod_time = os.path.getmtime(CACHE_FILE)
        if time.time() - file_mod_time < CACHE_DURATION:
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading cache: {e}")

    # Fetch new data
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse XML
        root = ET.fromstring(response.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        entries = root.findall('atom:entry', ns)
        
        parsed_entries = []
        
        for entry in entries:
            title = entry.find('atom:title', ns).text
            updated_raw = entry.find('atom:updated', ns).text
            
            # Find link
            link_elem = entry.find('atom:link[@rel="alternate"]', ns)
            if link_elem is None:
                link_elem = entry.find('atom:link', ns)
            link = link_elem.attrib.get('href') if link_elem is not None else ""
            
            # Content
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ""
            
            soup = BeautifulSoup(content_html, 'html.parser')
            
            current_category = "General"
            category_blocks = []
            current_elements = []
            
            # Iterate through children to group consecutive paragraphs/lists under headings
            for child in soup.children:
                if child.name in ['h1', 'h2', 'h3', 'h4']:
                    if current_elements:
                        category_blocks.append({
                            'category': current_category,
                            'elements': current_elements
                        })
                        current_elements = []
                    current_category = child.get_text().strip()
                elif child.name in ['p', 'ul', 'ol', 'div', 'table', 'pre', 'blockquote']:
                    current_elements.append(child)
                elif child.name is None:
                    # Text nodes
                    text = child.strip()
                    if text:
                        current_elements.append(child)
            
            if current_elements:
                category_blocks.append({
                    'category': current_category,
                    'elements': current_elements
                })
                
            # Convert blocks to html and text
            entry_updates = []
            for block in category_blocks:
                block_html = "".join(str(el) for el in block['elements'])
                
                # Extract text for each sibling element and join with double newlines
                text_parts = []
                for el in block['elements']:
                    if hasattr(el, 'get_text'):
                        txt = el.get_text().strip()
                    else:
                        txt = str(el).strip()
                    if txt:
                        text_parts.append(txt)
                block_text = "\n\n".join(text_parts)
                
                if block_text:
                    entry_updates.append({
                        'category': block['category'],
                        'html': block_html,
                        'text': block_text
                    })
                    
            if not entry_updates and content_html.strip():
                # Extract text for all elements
                text_parts = []
                for el in soup.children:
                    if hasattr(el, 'get_text'):
                        txt = el.get_text().strip()
                    else:
                        txt = str(el).strip()
                    if txt:
                        text_parts.append(txt)
                fallback_text = "\n\n".join(text_parts) if text_parts else soup.get_text().strip()
                
                entry_updates.append({
                    'category': 'General',
                    'html': content_html,
                    'text': fallback_text
                })
                
            parsed_entries.append({
                'date': title,
                'updated_raw': updated_raw,
                'link': link,
                'updates': entry_updates
            })
            
        # Save cache
        try:
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(parsed_entries, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Error writing cache: {e}")
            
        return parsed_entries
        
    except Exception as e:
        print(f"Error fetching/parsing feed: {e}")
        # If fetch fails, try to load old cache regardless of age
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as cache_err:
                print(f"Error reading fallback cache: {cache_err}")
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def release_notes():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        notes = get_parsed_feed(force_refresh=force_refresh)
        # Add metadata like last updated timestamp
        last_updated = None
        if os.path.exists(CACHE_FILE):
            last_updated = os.path.getmtime(CACHE_FILE)
            
        return jsonify({
            'status': 'success',
            'last_updated': last_updated,
            'count': len(notes),
            'data': notes
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
