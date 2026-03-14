const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API ключ и идентификатор поисковой системы
const API_KEY = 'AIzaSyDUf-3oZhIMl9uRv70T1KntJCglMYqA22c';
const SEARCH_ENGINE_ID = '92a124f2131b54cb9';

// Файлы для логирования
const LOGS_DIR = path.join(__dirname, 'logs');
const SEARCH_LOG_FILE = path.join(LOGS_DIR, 'search_queries.txt');
const VISITED_LOG_FILE = path.join(LOGS_DIR, 'visited_sites.txt');

// Создаем директорию для логов, если она не существует
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Функция для записи в лог-файл
function logToFile(filename, data) {
    const timestamp = new Date().toLocaleString('ru-RU', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const logEntry = `[${timestamp}] ${data}\n`;
    
    fs.appendFile(filename, logEntry, (err) => {
        if (err) {
            console.error('Ошибка записи в лог-файл:', err);
        } else {
            console.log('Запись в лог-файл успешна:', filename);
        }
    });
}

// Основной маршрут
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API для поиска веб-страниц
app.get('/api/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Логируем поисковый запрос
        logToFile(SEARCH_LOG_FILE, `ПОИСК: "${query}" | Страница: ${page}`);
        
        const startIndex = (page - 1) * 10 + 1;
        
        // Запрос к Google Custom Search API
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: API_KEY,
                cx: SEARCH_ENGINE_ID,
                q: query,
                start: startIndex,
                num: 10,
                safe: 'off'
            }
        });

        // Обработка результатов
        const results = response.data.items ? response.data.items.map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            displayLink: item.displayLink,
            formattedUrl: item.formattedUrl
        })) : [];

        res.json({
            query,
            results,
            totalResults: response.data.searchInformation?.totalResults || 0,
            searchTime: response.data.searchInformation?.formattedSearchTime || 0,
            currentPage: parseInt(page),
            hasNextPage: startIndex + 10 <= 100
        });
        
    } catch (error) {
        console.error('Search error:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            return res.status(403).json({ 
                error: 'API quota exceeded or invalid API key',
                details: 'Daily limit or invalid credentials'
            });
        }
        
        res.status(500).json({ 
            error: 'Search failed',
            details: error.message 
        });
    }
});

// API для поиска изображений
app.get('/api/search/images', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        // Логируем поисковый запрос изображений
        logToFile(SEARCH_LOG_FILE, `ПОИСК ИЗОБРАЖЕНИЙ: "${query}" | Страница: ${page}`);
        
        const startIndex = (page - 1) * 10 + 1;
        
        // Запрос к Google Custom Search API для изображений
        const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
                key: API_KEY,
                cx: SEARCH_ENGINE_ID,
                q: query,
                start: startIndex,
                num: 10,
                searchType: 'image',
                safe: 'off'
            }
        });

        // Обработка результатов изображений
        const results = response.data.items ? response.data.items.map(item => ({
            title: item.title,
            link: item.link,
            image: {
                thumbnailLink: item.image?.thumbnailLink,
                contextLink: item.image?.contextLink,
                height: item.image?.height,
                width: item.image?.width
            },
            displayLink: item.displayLink,
            snippet: item.snippet
        })) : [];

        res.json({
            query,
            results,
            totalResults: response.data.searchInformation?.totalResults || 0,
            searchTime: response.data.searchInformation?.formattedSearchTime || 0,
            currentPage: parseInt(page),
            hasNextPage: startIndex + 10 <= 100
        });
        
    } catch (error) {
        console.error('Image search error:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            return res.status(403).json({ 
                error: 'API quota exceeded or invalid API key',
                details: 'Daily limit or invalid credentials'
            });
        }
        
        res.status(500).json({ 
            error: 'Image search failed',
            details: error.message 
        });
    }
});

// API для логирования посещенных сайтов
app.post('/api/log/visit', (req, res) => {
    try {
        const { query, url, title, type } = req.body;
        
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        
        // Логируем посещенный сайт
        const logData = `ПОСЕЩЕНИЕ: ${url} | Запрос: "${query || 'не указан'}" | Тип: ${type || 'не указан'} | Название: ${title || 'не указано'}`;
        logToFile(VISITED_LOG_FILE, logData);
        
        res.json({ success: true, message: 'Visit logged successfully' });
        
    } catch (error) {
        console.error('Log visit error:', error);
        res.status(500).json({ error: 'Failed to log visit' });
    }
});

// API для получения логов (только для отладки, можно удалить в продакшене)
app.get('/api/logs', (req, res) => {
    try {
        const logs = {
            searchLogs: fs.existsSync(SEARCH_LOG_FILE) 
                ? fs.readFileSync(SEARCH_LOG_FILE, 'utf8') 
                : 'Файл логов поиска пуст или не существует',
            visitedLogs: fs.existsSync(VISITED_LOG_FILE) 
                ? fs.readFileSync(VISITED_LOG_FILE, 'utf8') 
                : 'Файл логов посещений пуст или не существует'
        };
        
        res.json(logs);
        
    } catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to read logs' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Ultra Search Server запущен на порту ${PORT}`);
    console.log(`🌐 Откройте http://localhost:${PORT} в браузере`);
    console.log(`📝 Логи сохраняются в папке: ${LOGS_DIR}`);
    console.log(`   - Поисковые запросы: search_queries.txt`);
    console.log(`   - Посещенные сайты: visited_sites.txt`);
});