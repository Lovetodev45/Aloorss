// ========== ALOORSS AUTOMATION ENGINE ==========
// Systeme complet d'automatisation : RSS -> IA -> Publication -> Newsletter

const AUTO_STORAGE = 'aloorss_automation';

// ========== CONFIG ==========
const DEFAULT_AUTO_CONFIG = {
    // API Keys
    aiProvider: 'openai', // 'openai' | 'anthropic'
    apiKey: '',

    // RSS Feeds
    feeds: [
        { url: 'https://techcrunch.com/feed/', name: 'TechCrunch', enabled: true },
        { url: 'https://www.theverge.com/rss/index.xml', name: 'The Verge', enabled: true },
        { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', name: 'Ars Technica', enabled: true },
        { url: 'https://hnrss.org/frontpage', name: 'Hacker News', enabled: true },
        { url: 'https://www.artificialintelligence-news.com/feed/', name: 'AI News', enabled: true },
        { url: 'https://blog.google/technology/ai/rss/', name: 'Google AI Blog', enabled: true },
    ],

    // Automation settings
    autoGenerate: false,
    autoPublish: false,
    generateInterval: 6, // hours between auto-generation
    maxArticlesPerDay: 5,
    defaultCategory: 'ai',
    defaultPremium: false,
    language: 'fr',

    // Newsletter
    newsletterEnabled: false,
    newsletterProvider: 'emailjs', // 'emailjs' | 'webhook'
    emailjsServiceId: '',
    emailjsTemplateId: '',
    emailjsPublicKey: '',
    webhookUrl: '',
    newsletterSchedule: '08:00', // heure d'envoi
    newsletterFrequency: 'daily', // 'daily' | 'weekly'
    lastNewsletterSent: null,

    // State
    lastFetch: null,
    lastGeneration: null,
    articlesGeneratedToday: 0,
    lastResetDate: null,
    feedCache: [],
    generationQueue: [],
    generationLog: [],
};

function loadAutoConfig() {
    try {
        const saved = localStorage.getItem(AUTO_STORAGE);
        if (saved) {
            const parsed = JSON.parse(saved);
            return { ...DEFAULT_AUTO_CONFIG, ...parsed };
        }
    } catch (e) {}
    return { ...DEFAULT_AUTO_CONFIG };
}

function saveAutoConfig(config) {
    localStorage.setItem(AUTO_STORAGE, JSON.stringify(config));
}

let autoConfig = loadAutoConfig();

// ========== RSS FEED ENGINE ==========

const RSS_PROXY = 'https://api.allorigins.win/raw?url=';

async function fetchRSSFeed(feedUrl) {
    try {
        const response = await fetch(RSS_PROXY + encodeURIComponent(feedUrl), {
            signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        return parseRSS(text);
    } catch (e) {
        console.warn(`Feed fetch failed: ${feedUrl}`, e.message);
        return [];
    }
}

function parseRSS(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = [];

    // RSS 2.0
    doc.querySelectorAll('item').forEach(item => {
        items.push({
            title: getTagText(item, 'title'),
            link: getTagText(item, 'link'),
            description: stripHtml(getTagText(item, 'description')),
            pubDate: getTagText(item, 'pubDate'),
            source: getTagText(item, 'source') || '',
        });
    });

    // Atom
    if (items.length === 0) {
        doc.querySelectorAll('entry').forEach(entry => {
            const link = entry.querySelector('link')?.getAttribute('href') || '';
            items.push({
                title: getTagText(entry, 'title'),
                link,
                description: stripHtml(getTagText(entry, 'summary') || getTagText(entry, 'content')),
                pubDate: getTagText(entry, 'published') || getTagText(entry, 'updated'),
                source: '',
            });
        });
    }

    return items;
}

function getTagText(parent, tag) {
    const el = parent.querySelector(tag);
    return el ? el.textContent.trim() : '';
}

function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent.trim().substring(0, 500);
}

async function fetchAllFeeds() {
    logAuto('Recuperation des flux RSS...');
    const enabledFeeds = autoConfig.feeds.filter(f => f.enabled);
    const results = await Promise.allSettled(
        enabledFeeds.map(async feed => {
            const items = await fetchRSSFeed(feed.url);
            return items.map(item => ({ ...item, feedName: feed.name }));
        })
    );

    const allItems = [];
    results.forEach(r => {
        if (r.status === 'fulfilled') allItems.push(...r.value);
    });

    // Sort by date, deduplicate by title similarity
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    const unique = deduplicateItems(allItems);

    // Filter AI/tech relevant items
    const filtered = unique.filter(item => isAIRelevant(item));

    autoConfig.feedCache = filtered.slice(0, 50);
    autoConfig.lastFetch = new Date().toISOString();
    saveAutoConfig(autoConfig);

    logAuto(`${filtered.length} articles pertinents recuperes depuis ${enabledFeeds.length} flux`);
    return filtered;
}

function deduplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
        const key = item.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function isAIRelevant(item) {
    const text = (item.title + ' ' + item.description).toLowerCase();
    const keywords = [
        'ai', 'artificial intelligence', 'intelligence artificielle',
        'machine learning', 'deep learning', 'neural', 'gpt', 'claude',
        'llm', 'chatbot', 'openai', 'anthropic', 'google ai', 'gemini',
        'midjourney', 'stable diffusion', 'generative', 'transformer',
        'automation', 'automatisation', 'robot', 'tech', 'startup',
        'saas', 'api', 'developer', 'coding', 'programming',
        'model', 'training', 'inference', 'compute', 'gpu', 'nvidia',
        'microsoft', 'meta ai', 'apple intelligence', 'copilot',
    ];
    return keywords.some(kw => text.includes(kw));
}

// ========== AI CONTENT GENERATION ==========

async function generateArticleFromFeedItem(item) {
    if (!autoConfig.apiKey) {
        logAuto('ERREUR: Cle API manquante. Configure-la dans les parametres.');
        return null;
    }

    const prompt = buildPrompt(item);

    try {
        let result;
        if (autoConfig.aiProvider === 'anthropic') {
            result = await callAnthropicAPI(prompt);
        } else {
            result = await callOpenAIAPI(prompt);
        }

        if (!result) return null;

        const article = parseGeneratedArticle(result, item);
        logAuto(`Article genere: "${article.title}"`);
        return article;
    } catch (e) {
        logAuto(`ERREUR generation: ${e.message}`);
        return null;
    }
}

function buildPrompt(item) {
    return `Tu es un redacteur expert en technologie et intelligence artificielle pour le blog "Aloorss".
A partir de cette actualite, ecris un article complet et engageant EN FRANCAIS.

SOURCE: ${item.feedName}
TITRE ORIGINAL: ${item.title}
DESCRIPTION: ${item.description}
LIEN: ${item.link}

INSTRUCTIONS:
- Ecris un titre accrocheur en francais (different de l'original)
- Ecris un extrait de 1-2 phrases (pour la preview)
- Ecris le contenu complet (400-600 mots)
- Ton: accessible, direct, utile. Pas de jargon inutile.
- Inclus des conseils pratiques ou une analyse
- Structure avec des sections claires

REPONDS EXACTEMENT dans ce format JSON:
{
  "title": "Le titre en francais",
  "excerpt": "L'extrait court",
  "content": "Le contenu complet avec des \\n pour les retours a la ligne",
  "category": "ai|news|tools|tuto"
}`;
}

async function callOpenAIAPI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${autoConfig.apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 1500
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

async function callAnthropicAPI(prompt) {
    // Anthropic API requires server-side calls (CORS).
    // We use a proxy approach or direct if CORS headers are set.
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': autoConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

function parseGeneratedArticle(rawText, sourceItem) {
    try {
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = rawText;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];

        const parsed = JSON.parse(jsonStr);
        const words = (parsed.content || '').split(/\s+/).length;

        return {
            id: Date.now() + Math.random(),
            title: parsed.title || sourceItem.title,
            excerpt: parsed.excerpt || sourceItem.description.substring(0, 150),
            content: parsed.content || sourceItem.description,
            category: parsed.category || autoConfig.defaultCategory,
            premium: autoConfig.defaultPremium,
            date: new Date().toISOString().split('T')[0],
            readTime: Math.max(1, Math.round(words / 200)) + ' min',
            source: sourceItem.link,
            autoGenerated: true
        };
    } catch (e) {
        logAuto(`Erreur parsing JSON, utilisation du contenu brut`);
        return {
            id: Date.now() + Math.random(),
            title: sourceItem.title,
            excerpt: sourceItem.description.substring(0, 150),
            content: rawText.substring(0, 2000),
            category: autoConfig.defaultCategory,
            premium: autoConfig.defaultPremium,
            date: new Date().toISOString().split('T')[0],
            readTime: '3 min',
            source: sourceItem.link,
            autoGenerated: true
        };
    }
}

// ========== AUTO-PUBLISH PIPELINE ==========

async function runAutomationCycle() {
    logAuto('=== Cycle d\'automatisation demarre ===');

    // Reset daily counter if new day
    const today = new Date().toISOString().split('T')[0];
    if (autoConfig.lastResetDate !== today) {
        autoConfig.articlesGeneratedToday = 0;
        autoConfig.lastResetDate = today;
    }

    if (autoConfig.articlesGeneratedToday >= autoConfig.maxArticlesPerDay) {
        logAuto(`Limite quotidienne atteinte (${autoConfig.maxArticlesPerDay} articles)`);
        return;
    }

    // Step 1: Fetch feeds
    const feedItems = await fetchAllFeeds();
    if (feedItems.length === 0) {
        logAuto('Aucun article trouve dans les flux');
        return;
    }

    // Step 2: Filter out already published titles
    const existingTitles = new Set(appData.articles.map(a => a.title.toLowerCase()));
    const newItems = feedItems.filter(item =>
        !existingTitles.has(item.title.toLowerCase())
    );

    if (newItems.length === 0) {
        logAuto('Tous les articles sont deja publies');
        return;
    }

    // Step 3: Generate articles
    const toGenerate = newItems.slice(0, autoConfig.maxArticlesPerDay - autoConfig.articlesGeneratedToday);
    logAuto(`Generation de ${toGenerate.length} article(s)...`);

    for (const item of toGenerate) {
        const article = await generateArticleFromFeedItem(item);
        if (article) {
            if (autoConfig.autoPublish) {
                publishArticle(article);
                autoConfig.articlesGeneratedToday++;
                logAuto(`Publie: "${article.title}"`);
            } else {
                autoConfig.generationQueue.push(article);
                logAuto(`En file d'attente: "${article.title}"`);
            }
        }
        // Small delay between API calls
        await sleep(2000);
    }

    autoConfig.lastGeneration = new Date().toISOString();
    saveAutoConfig(autoConfig);
    logAuto('=== Cycle termine ===');

    // Update UI
    if (typeof render === 'function') render();
    if (typeof renderAutomationDashboard === 'function') renderAutomationDashboard();
}

function publishArticle(article) {
    if (typeof appData !== 'undefined') {
        article.id = appData.nextId++;
        appData.articles.unshift(article);
        saveAppData(appData);
    }
}

function publishFromQueue(index) {
    const article = autoConfig.generationQueue.splice(index, 1)[0];
    if (article) {
        publishArticle(article);
        saveAutoConfig(autoConfig);
        logAuto(`Publie depuis la file: "${article.title}"`);
        if (typeof render === 'function') render();
        if (typeof renderAutomationDashboard === 'function') renderAutomationDashboard();
        showToast('Article publie !');
    }
}

function publishAllFromQueue() {
    while (autoConfig.generationQueue.length > 0) {
        publishFromQueue(0);
    }
}

function removeFromQueue(index) {
    autoConfig.generationQueue.splice(index, 1);
    saveAutoConfig(autoConfig);
    if (typeof renderAutomationDashboard === 'function') renderAutomationDashboard();
}

// ========== NEWSLETTER ENGINE ==========

async function sendNewsletter() {
    if (!autoConfig.newsletterEnabled) return;

    const subscribers = appData.subscribers || [];
    if (subscribers.length === 0) {
        logAuto('Newsletter: aucun abonne');
        return;
    }

    // Get latest articles (last 24h or last 5)
    const recentArticles = appData.articles
        .filter(a => !a.premium)
        .slice(0, 5);

    if (recentArticles.length === 0) {
        logAuto('Newsletter: aucun article a envoyer');
        return;
    }

    const newsletterHtml = buildNewsletterContent(recentArticles);

    if (autoConfig.newsletterProvider === 'emailjs') {
        await sendViaEmailJS(subscribers, newsletterHtml);
    } else if (autoConfig.newsletterProvider === 'webhook') {
        await sendViaWebhook(subscribers, newsletterHtml, recentArticles);
    }

    autoConfig.lastNewsletterSent = new Date().toISOString();
    saveAutoConfig(autoConfig);
    logAuto(`Newsletter envoyee a ${subscribers.length} abonne(s)`);
}

function buildNewsletterContent(articles) {
    const date = new Date().toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
ALOORSS - Le meilleur de l'IA | ${date}

${articles.map((a, i) => `
${i + 1}. ${a.title}
${a.excerpt}
`).join('\n')}

---
Tu recois cet email car tu es abonne a la newsletter Aloorss.
    `.trim();
}

async function sendViaEmailJS(subscribers, content) {
    if (!autoConfig.emailjsServiceId || !autoConfig.emailjsTemplateId || !autoConfig.emailjsPublicKey) {
        logAuto('Newsletter: configuration EmailJS incomplete');
        return;
    }

    // EmailJS envoie un email a la fois
    for (const email of subscribers) {
        try {
            await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: autoConfig.emailjsServiceId,
                    template_id: autoConfig.emailjsTemplateId,
                    user_id: autoConfig.emailjsPublicKey,
                    template_params: {
                        to_email: email,
                        subject: `Aloorss - Le resume IA du ${new Date().toLocaleDateString('fr-FR')}`,
                        content: content
                    }
                })
            });
            logAuto(`Email envoye a ${email}`);
        } catch (e) {
            logAuto(`Echec envoi a ${email}: ${e.message}`);
        }
        await sleep(500);
    }
}

async function sendViaWebhook(subscribers, content, articles) {
    if (!autoConfig.webhookUrl) {
        logAuto('Newsletter: URL webhook manquante');
        return;
    }

    try {
        await fetch(autoConfig.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subscribers,
                subject: `Aloorss - Le resume IA du ${new Date().toLocaleDateString('fr-FR')}`,
                content,
                articles: articles.map(a => ({
                    title: a.title,
                    excerpt: a.excerpt,
                    category: a.category
                }))
            })
        });
        logAuto('Webhook newsletter envoye');
    } catch (e) {
        logAuto(`Echec webhook: ${e.message}`);
    }
}

// ========== SCHEDULER ==========

let automationTimer = null;
let newsletterTimer = null;

function startAutomationScheduler() {
    stopAutomationScheduler();

    if (autoConfig.autoGenerate) {
        const intervalMs = autoConfig.generateInterval * 60 * 60 * 1000;
        automationTimer = setInterval(() => {
            runAutomationCycle();
        }, intervalMs);
        logAuto(`Planificateur demarre: generation toutes les ${autoConfig.generateInterval}h`);
    }

    if (autoConfig.newsletterEnabled) {
        // Check every minute if it's time to send newsletter
        newsletterTimer = setInterval(() => {
            checkNewsletterSchedule();
        }, 60000);
        logAuto('Planificateur newsletter demarre');
    }
}

function stopAutomationScheduler() {
    if (automationTimer) {
        clearInterval(automationTimer);
        automationTimer = null;
    }
    if (newsletterTimer) {
        clearInterval(newsletterTimer);
        newsletterTimer = null;
    }
}

function checkNewsletterSchedule() {
    const now = new Date();
    const [schedH, schedM] = autoConfig.newsletterSchedule.split(':').map(Number);
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    if (currentH === schedH && currentM === schedM) {
        const today = now.toISOString().split('T')[0];
        const lastSent = autoConfig.lastNewsletterSent?.split('T')[0];

        if (autoConfig.newsletterFrequency === 'daily' && lastSent !== today) {
            sendNewsletter();
        } else if (autoConfig.newsletterFrequency === 'weekly') {
            const daysSinceLastSent = lastSent
                ? Math.floor((now - new Date(lastSent)) / 86400000)
                : 999;
            if (daysSinceLastSent >= 7) {
                sendNewsletter();
            }
        }
    }
}

// ========== LOGGING ==========

function logAuto(message) {
    const entry = {
        time: new Date().toLocaleTimeString('fr-FR'),
        date: new Date().toISOString(),
        message
    };
    autoConfig.generationLog.unshift(entry);
    if (autoConfig.generationLog.length > 100) {
        autoConfig.generationLog = autoConfig.generationLog.slice(0, 100);
    }
    saveAutoConfig(autoConfig);
    console.log(`[ALOORSS] ${entry.time} - ${message}`);
}

// ========== HELPERS ==========

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========== INIT ==========

function initAutomation() {
    if (autoConfig.autoGenerate || autoConfig.newsletterEnabled) {
        startAutomationScheduler();
    }
}
