document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://api.webstatus.dev/v1/features';

    function slugify(s) {
        return String(s || '')
            .toLowerCase()
            .trim()
            .replace(/['"()]/g, '')
            .replace(/[^a-z0-9\-]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }

    async function fetchFeatureBySlug(slug) {
        const url = `${API_BASE}/${encodeURIComponent(slug)}`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status} from ${url}`);
    }

    let allFeaturesCache = null;

    async function fetchAllFeatures() {
        if (allFeaturesCache) return allFeaturesCache;

        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching feature list`);
        const json = await res.json();

        if (Array.isArray(json)) {
            allFeaturesCache = json;
        } else if (json && typeof json === 'object') {
            if (Array.isArray(json.data)) {
                allFeaturesCache = json.data;
            } else {
                allFeaturesCache = Object.values(json);
            }
        } else {
            allFeaturesCache = [];
        }

        return allFeaturesCache;
    }

    async function populateAutocomplete() {
        try {
            const all = await fetchAllFeatures();
            const featureInput = document.getElementById('featureInput');

            const dataList = document.createElement('datalist');
            dataList.id = 'featuresList';
            featureInput.setAttribute('list', 'featuresList');
            document.body.appendChild(dataList);

            all.forEach(f => {
                const option = document.createElement('option');
                option.value = f.name || f.feature_id || f.id;
                dataList.appendChild(option);
            });
        } catch (err) {
            console.error('Error populating autocomplete:', err);
        }
    }

    function prettyStatus(status) {
        if (!status) return 'unknown';
        if (status === 'widely') return '✅ Widely available (Baseline)';
        if (status === 'newly') return '✅ Newly available (Baseline)';
        if (status === 'limited' || status === 'partial' || status === 'not') return '❌ Not Baseline';
        return `ℹ ${status}`;
    }

    async function checkFeature() {
        const q = document.getElementById('featureInput').value.trim();
        const resultDiv = document.getElementById('result');
        resultDiv.style.color = 'black';

        if (!q) {
            resultDiv.textContent = '⚠ Please enter a feature name.';
            resultDiv.style.color = 'orange';
            return;
        }

        resultDiv.textContent = 'Checking…';

        try {
            const slug = slugify(q);
            let feature = await fetchFeatureBySlug(slug);

            if (!feature) {
                const all = await fetchAllFeatures();
                const lowered = q.toLowerCase();
                const matches = all.filter(f => {
                    const id = String(f.feature_id || f.id || '').toLowerCase();
                    const name = String(f.name || '').toLowerCase();
                    return id.includes(lowered) || name.includes(lowered);
                });

                if (matches.length === 0) {
                    resultDiv.textContent = `🤔 "${q}" not found. Try a different query or a more specific name (e.g., 'backdrop-filter').`;
                    resultDiv.style.color = 'orange';
                    return;
                }

                if (matches.length > 1) {
                    resultDiv.innerHTML = `<b>Multiple matches (${matches.length}):</b><br>` +
                        matches.slice(0, 20).map(p => `${p.feature_id || p.id || p.name} — ${p.name || ''}`).join('<br>');
                    return;
                }
                const id = matches[0].feature_id || matches[0].id || matches[0].name;
                feature = await fetchFeatureBySlug(id);
                if (!feature) {
                    resultDiv.textContent = 'Could not fetch feature details after finding a match.';
                    resultDiv.style.color = 'orange';
                    return;
                }
            }

            const status = feature?.baseline?.status || feature?.status?.baseline || null;
            const line = `${feature.feature_id || feature.id} — ${prettyStatus(status)}${feature.name ? ' — ' + feature.name : ''}`;
            resultDiv.textContent = line;
            resultDiv.style.color = (status === 'widely' || status === 'newly') ? 'green' : 'red';

        } catch (err) {
            console.error(err);
            resultDiv.textContent = 'Error fetching Baseline data (see console).';
            resultDiv.style.color = 'orange';
        }
    }

    document.getElementById('checkBtn').addEventListener('click', checkFeature);
    document.getElementById('featureInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkFeature();
    });

    populateAutocomplete();
});