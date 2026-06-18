// Global State
let releaseNotesData = [];
let activeCategory = 'all';
let searchKeyword = '';

// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const lastSyncText = document.getElementById('lastSyncText');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const feedTimeline = document.getElementById('feedTimeline');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');

// Stats Elements
const statAll = document.getElementById('statAll');
const statFeatures = document.getElementById('statFeatures');
const statAnnouncements = document.getElementById('statAnnouncements');
const statIssues = document.getElementById('statIssues');
const statChanged = document.getElementById('statChanged');

// Modal Elements
const tweetModal = document.getElementById('tweetModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const refDate = document.getElementById('refDate');
const refBadge = document.getElementById('refBadge');
const refContent = document.getElementById('refContent');
const refLink = document.getElementById('refLink');
const tweetTextarea = document.getElementById('tweetTextarea');
const charCountNum = document.getElementById('charCountNum');
const charStatusText = document.getElementById('charStatusText');
const progressRing = document.getElementById('progressRing');
const copyTweetBtn = document.getElementById('copyTweetBtn');
const copyIcon = document.getElementById('copyIcon');
const checkIcon = document.getElementById('checkIcon');
const copyBtnText = document.getElementById('copyBtnText');
const postTweetBtn = document.getElementById('postTweetBtn');

// Progress Ring Configuration
const RING_RADIUS = 14;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~87.96

// Setup Progress Ring on Load
if (progressRing) {
    progressRing.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    progressRing.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Refresh Button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search input
    searchInput.addEventListener('input', (e) => {
        searchKeyword = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchKeyword ? 'block' : 'none';
        filterAndRender();
    });

    // Clear Search Button
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchKeyword = '';
        clearSearchBtn.style.display = 'none';
        filterAndRender();
    });

    // Reset Filters Button (empty state)
    resetFiltersBtn.addEventListener('click', resetAllFilters);

    // Sidebar Category Pills
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const category = pill.getAttribute('data-category');
            setCategoryFilter(category);
        });
    });

    // Stats Row Cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('click', () => {
            const category = card.getAttribute('data-type');
            setCategoryFilter(category);
        });
    });

    // Modal Close
    closeModalBtn.addEventListener('click', closeComposerModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeComposerModal();
        }
    });

    // Tweet Textarea Input (Character limit logic)
    tweetTextarea.addEventListener('input', updateTweetCharacterCount);

    // Copy Tweet Content
    copyTweetBtn.addEventListener('click', copyTweetContent);

    // Post to X (Twitter)
    postTweetBtn.addEventListener('click', publishTweet);
}

// Set Category Filter and highlight correct active elements
function setCategoryFilter(category) {
    activeCategory = category;
    
    // Update Sidebar Pills
    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        if (pill.getAttribute('data-category') === category) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    // Update Stats row highlighting
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        if (card.getAttribute('data-type') === category) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    filterAndRender();
}

// Reset Search & Category Filters
function resetAllFilters() {
    searchInput.value = '';
    searchKeyword = '';
    clearSearchBtn.style.display = 'none';
    setCategoryFilter('all');
}

// Fetch Release Notes from Backend
async function fetchReleaseNotes(forceRefresh = false) {
    // Show loading UI
    loadingState.style.display = 'flex';
    feedTimeline.style.display = 'none';
    emptyState.style.display = 'none';
    
    if (forceRefresh) {
        refreshBtn.disabled = true;
        refreshIcon.classList.add('spinning');
    }

    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const resData = await response.json();
        
        if (resData.status === 'success') {
            releaseNotesData = resData.data;
            updateLastSyncTime(resData.last_updated);
            calculateAndDisplayStats(releaseNotesData);
            filterAndRender();
            
            if (forceRefresh) {
                showToast('Release notes successfully updated from live feed!');
            }
        } else {
            throw new Error(resData.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(forceRefresh ? `Failed to refresh feed: ${error.message}` : `Error loading release notes: ${error.message}`, 'error');
        
        // Show empty state if we have no data at all
        if (releaseNotesData.length === 0) {
            emptyState.style.display = 'flex';
            loadingState.style.display = 'none';
        }
    } finally {
        // Stop loading UI
        loadingState.style.display = 'none';
        if (forceRefresh) {
            refreshBtn.disabled = false;
            refreshIcon.classList.remove('spinning');
        }
    }
}

// Format and Display Cached/Sync Time
function updateLastSyncTime(epochSeconds) {
    if (!epochSeconds) {
        lastSyncText.textContent = "Synced: just now";
        return;
    }
    const date = new Date(epochSeconds * 1000);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    lastSyncText.textContent = `Feed cache: synced at ${timeStr}`;
}

// Calculate Stats for Overview Cards
function calculateAndDisplayStats(data) {
    let total = 0;
    let features = 0;
    let announcements = 0;
    let issues = 0;
    let changed = 0;

    data.forEach(entry => {
        entry.updates.forEach(update => {
            total++;
            const cat = update.category.toLowerCase();
            if (cat.includes('feature')) features++;
            else if (cat.includes('announcement')) announcements++;
            else if (cat.includes('issue') || cat.includes('fix') || cat.includes('security')) issues++;
            else if (cat.includes('change') || cat.includes('changed')) changed++;
        });
    });

    statAll.textContent = total;
    statFeatures.textContent = features;
    statAnnouncements.textContent = announcements;
    statIssues.textContent = issues;
    statChanged.textContent = changed;
}

// Filters data based on active filters and renders the timeline
function filterAndRender() {
    const filteredEntries = [];

    releaseNotesData.forEach(entry => {
        const matchingUpdates = entry.updates.filter(update => {
            // Category Match
            let catMatch = true;
            if (activeCategory !== 'all') {
                catMatch = update.category.toLowerCase() === activeCategory.toLowerCase();
            }
            
            // Search Keyword Match
            let keywordMatch = true;
            if (searchKeyword) {
                const textContent = update.text.toLowerCase();
                const catContent = update.category.toLowerCase();
                const dateContent = entry.date.toLowerCase();
                keywordMatch = textContent.includes(searchKeyword) || 
                               catContent.includes(searchKeyword) || 
                               dateContent.includes(searchKeyword);
            }

            return catMatch && keywordMatch;
        });

        if (matchingUpdates.length > 0) {
            filteredEntries.push({
                ...entry,
                updates: matchingUpdates
            });
        }
    });

    renderTimeline(filteredEntries);
}

// Render Timeline Content
function renderTimeline(entries) {
    if (entries.length === 0) {
        feedTimeline.style.display = 'none';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    feedTimeline.style.display = 'block';
    feedTimeline.innerHTML = '';

    entries.forEach(entry => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'timeline-group';

        // Format raw date
        let updatedTimeStr = '';
        if (entry.updated_raw) {
            try {
                const dateObj = new Date(entry.updated_raw);
                updatedTimeStr = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) {
                updatedTimeStr = '';
            }
        }

        // HTML structure for timeline group
        groupDiv.innerHTML = `
            <div class="timeline-node"></div>
            <div class="timeline-date">
                <span>${entry.date}</span>
                ${updatedTimeStr && updatedTimeStr !== entry.date ? `<span class="raw-date">(${updatedTimeStr})</span>` : ''}
            </div>
            <div class="timeline-updates" id="updates-${entry.date.replace(/[^a-zA-Z0-9]/g, '_')}"></div>
        `;

        feedTimeline.appendChild(groupDiv);
        const updatesContainer = groupDiv.querySelector('.timeline-updates');

        // Inject individual updates inside the group
        entry.updates.forEach((update, idx) => {
            const card = document.createElement('article');
            card.className = 'update-card';
            card.setAttribute('data-category', update.category);
            
            const cardId = `card-${entry.date.replace(/[^a-zA-Z0-9]/g, '_')}-${idx}`;
            card.id = cardId;

            card.innerHTML = `
                <div class="card-header">
                    <span class="cat-badge badge-${update.category}">${update.category}</span>
                    <div class="card-actions">
                        <button class="btn btn-tweet-action btn-tweet" aria-label="Compose tweet for this update">
                            <svg viewBox="0 0 24 24" class="btn-icon x-logo" style="margin-right: 4px;">
                                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            <span>Share on X</span>
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
            `;

            // Setup click handler for tweet share button
            const tweetBtn = card.querySelector('.btn-tweet');
            tweetBtn.addEventListener('click', () => {
                openComposerModal(entry, update);
            });

            updatesContainer.appendChild(card);
        });
    });
}

// Generate Default Tweet Text (fit within limits)
function generateDefaultTweet(date, category, text, link) {
    // Clean text by turning tabs/newlines/excess spaces into single spaces
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    const header = `Google #BigQuery Update [${date}] | ${category}:\n\n`;
    // We add tag #GCP #GoogleCloud for reach
    const footer = `\n\n#GCP #GoogleCloud\nRead: ${link}`;
    
    // Calculate space available for body text
    const reservedLength = header.length + footer.length;
    const availableLength = 280 - reservedLength;
    
    if (cleanText.length > availableLength) {
        // Truncate text nicely
        cleanText = cleanText.substring(0, availableLength - 3) + '...';
    }
    
    return `${header}${cleanText}${footer}`;
}

// Open Tweet Composer Modal
function openComposerModal(entry, update) {
    // Populate Modal Left panel
    refDate.textContent = entry.date;
    refBadge.className = `ref-badge badge-${update.category}`;
    refBadge.textContent = update.category;
    refContent.innerHTML = update.html;
    refLink.href = entry.link;

    // Generate draft & fill textarea
    const draftTweet = generateDefaultTweet(entry.date, update.category, update.text, entry.link);
    tweetTextarea.value = draftTweet;

    // Open Modal Overlay
    tweetModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock background scroll
    
    // Focus & select textarea
    tweetTextarea.focus();
    tweetTextarea.setSelectionRange(tweetTextarea.value.length, tweetTextarea.value.length);
    
    // Init character counter
    updateTweetCharacterCount();
}

// Close Tweet Composer Modal
function closeComposerModal() {
    tweetModal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scroll
}

// Update character limits and UI indicators
function updateTweetCharacterCount() {
    const currentText = tweetTextarea.value;
    const currentLength = currentText.length;
    const remaining = 280 - currentLength;
    
    charCountNum.textContent = remaining >= 0 ? remaining : Math.abs(remaining);
    
    if (remaining >= 0) {
        charStatusText.textContent = `${remaining} characters left`;
        charStatusText.style.color = 'var(--color-text-muted)';
        postTweetBtn.disabled = currentLength === 0;
        
        // Progress Ring Math
        const progress = Math.min(currentLength / 280, 1);
        const offset = RING_CIRCUMFERENCE - (progress * RING_CIRCUMFERENCE);
        progressRing.style.strokeDashoffset = offset;
        
        // Color shifting
        if (remaining <= 20) {
            // Orange warning
            progressRing.style.stroke = '#f59e0b';
            charCountNum.style.color = '#f59e0b';
        } else {
            // Default Twitter Blue
            progressRing.style.stroke = '#1d9bf0';
            charCountNum.style.color = 'var(--color-text-muted)';
        }
    } else {
        // Over limit
        charStatusText.textContent = `${Math.abs(remaining)} characters over limit!`;
        charStatusText.style.color = '#ef4444';
        charCountNum.style.color = '#ef4444';
        postTweetBtn.disabled = true;
        
        // Solid Red ring
        progressRing.style.strokeDashoffset = 0;
        progressRing.style.stroke = '#ef4444';
    }
}

// Copy Tweet Content to Clipboard
async function copyTweetContent() {
    const textToCopy = tweetTextarea.value;
    if (!textToCopy) return;

    try {
        await navigator.clipboard.writeText(textToCopy);
        
        // Show success animation on copy button
        copyIcon.style.display = 'none';
        checkIcon.style.display = 'block';
        copyBtnText.textContent = 'Copied!';
        showToast('Post copied to clipboard!');
        
        setTimeout(() => {
            copyIcon.style.display = 'block';
            checkIcon.style.display = 'none';
            copyBtnText.textContent = 'Copy';
        }, 2000);
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

// Launch Twitter Tweet Intent
function publishTweet() {
    const tweetText = tweetTextarea.value;
    if (!tweetText) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420,toolbar=0,status=0');
    
    closeComposerModal();
    showToast('Redirected to X composer!');
}

// Show Toast Alert
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close" aria-label="Close message">×</button>
    `;
    
    // Close button event
    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
    });

    toastContainer.appendChild(toast);

    // Auto dismiss after 3.5s
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px) scale(0.9)';
            setTimeout(() => toast.remove(), 300);
        }
    }, 3500);
}
