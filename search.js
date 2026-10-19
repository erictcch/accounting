// Client-side search for Accounting Intelligence site
(function() {
    'use strict';
    
    let searchIndex = [];
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    let debounceTimer = null;
    let selectedIndex = -1;
    
    function init() {
        if (!input || !results) return;
        
        input.addEventListener('input', onInput);
        input.addEventListener('focus', onFocus);
        input.addEventListener('keydown', onKeydown);
        document.addEventListener('click', onDocClick);
        
        // Load search index
        fetch('search-index.json')
            .then(r => r.ok ? r.json() : [])
            .then(data => { searchIndex = data; console.log(`Search index loaded: ${data.length} items`); })
            .catch(err => console.warn('Search index load failed:', err));
    }
    
    function onInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = input.value.trim().toLowerCase();
            if (query.length < 2) {
                hideResults();
                return;
            }
            showResults(search(query));
        }, 150);
    }
    
    function onFocus() {
        const query = input.value.trim().toLowerCase();
        if (query.length >= 2) {
            showResults(search(query));
        }
    }
    
    function onKeydown(e) {
        const items = results.querySelectorAll('.search-result-item');
        if (!items.length) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex].click();
        } else if (e.key === 'Escape') {
            hideResults();
            input.blur();
        }
    }
    
    function onDocClick(e) {
        if (!results.contains(e.target) && e.target !== input) {
            hideResults();
        }
    }
    
    function search(query) {
        const terms = query.split(/\s+/).filter(t => t.length > 0);
        
        return searchIndex
            .map(item => {
                let score = 0;
                const searchable = [
                    item.title,
                    item.summary,
                    item.category,
                    item.source,
                    ...item.tags
                ].join(' ').toLowerCase();
                
                for (const term of terms) {
                    if (item.title.toLowerCase().includes(term)) score += 10;
                    if (item.summary.toLowerCase().includes(term)) score += 5;
                    if (item.category.toLowerCase().includes(term)) score += 3;
                    if (item.tags.some(t => t.toLowerCase().includes(term))) score += 2;
                    if (searchable.includes(term)) score += 1;
                }
                
                return { item, score };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .map(r => r.item);
    }
    
    function showResults(items) {
        if (!items.length) {
            results.innerHTML = '<div class="search-result-item" style="padding:16px;color:var(--fg-muted);">No results found</div>';
        } else {
            results.innerHTML = items.map(item => `
                <a href="${item.url}" class="search-result-item">
                    <div class="search-result-title">${highlight(item.title, input.value)}</div>
                    <div class="search-result-meta">
                        ${item.category} • ${item.source} • ${item.date}
                    </div>
                </a>
            `).join('');
        }
        results.classList.add('open');
        selectedIndex = -1;
    }
    
    function hideResults() {
        results.classList.remove('open');
        selectedIndex = -1;
    }
    
    function updateSelection(items) {
        items.forEach((el, i) => {
            el.classList.toggle('selected', i === selectedIndex);
        });
        if (selectedIndex >= 0) {
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }
    
    function highlight(text, query) {
        if (!query) return escapeHtml(text);
        const terms = query.split(/\s+/).filter(t => t.length > 1);
        let result = escapeHtml(text);
        for (const term of terms) {
            const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi');
            result = result.replace(regex, '<mark>$1</mark>');
        }
        return result;
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Filter functionality for index/category pages
    function initFilters() {
        const categoryFilter = document.getElementById('category-filter');
        const sourceFilter = document.getElementById('source-filter');
        const sortFilter = document.getElementById('sort-filter');
        const grid = document.getElementById('items-grid');
        
        if (!grid) return;
        
        const cards = Array.from(grid.querySelectorAll('.item-card'));
        
        function applyFilters() {
            const cat = categoryFilter?.value || '';
            const src = sourceFilter?.value || '';
            const sort = sortFilter?.value || 'date-desc';
            
            let visible = cards.filter(card => {
                const matchCat = !cat || card.dataset.category === cat;
                const matchSrc = !src || card.dataset.source === src;
                return matchCat && matchSrc;
            });
            
            // Sort
            visible.sort((a, b) => {
                if (sort === 'date-asc') return dateVal(a) - dateVal(b);
                if (sort === 'date-desc') return dateVal(b) - dateVal(a);
                if (sort === 'title') return titleVal(a).localeCompare(titleVal(b));
                return 0;
            });
            
            // Reorder in DOM
            visible.forEach((card, i) => {
                card.style.order = i;
                card.style.display = '';
            });
            cards.filter(c => !visible.includes(c)).forEach(card => {
                card.style.display = 'none';
            });
        }
        
        function dateVal(card) {
            const dateEl = card.querySelector('.item-date');
            if (!dateEl) return 0;
            const d = new Date(dateEl.textContent);
            return isNaN(d) ? 0 : d.getTime();
        }
        
        function titleVal(card) {
            const titleEl = card.querySelector('.item-title a');
            return titleEl ? titleEl.textContent : '';
        }
        
        [categoryFilter, sourceFilter, sortFilter].forEach(el => {
            if (el) el.addEventListener('change', applyFilters);
        });
    }
    
    // Initialize when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { init(); initFilters(); });
    } else {
        init(); initFilters();
    }
})();