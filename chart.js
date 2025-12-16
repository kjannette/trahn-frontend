/**
 * TRAHN Grid Trader - Custom Canvas Chart with Day Carousel
 * No dependencies. Pure JavaScript.
 * Polls backend data for real-time updates.
 */

// ============================================
// Configuration
// ============================================
const CONFIG = {
    dataUrl: './data/current.json',
    pollIntervalMs: 5000,  // Poll every 5 seconds
    retryIntervalMs: 10000, // Retry after 10 seconds on failure
};

// ============================================
// Chart Class
// ============================================
class TrahnChart {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.tooltip = document.getElementById('tooltip');
        
        // Chart configuration
        this.padding = { top: 20, right: 80, bottom: 40, left: 20 };
        this.colors = {
            line: '#58a6ff',
            green: '#3fb950',
            greenFill: 'rgba(63, 185, 80, 0.12)',
            red: '#f85149',
            redFill: 'rgba(248, 81, 73, 0.12)',
            grid: '#21262d',
            text: '#8b949e',
            textMuted: '#484f58',
            baseline: '#30363d',
            buy: '#f0c000',
            sell: '#db6d28'
        };
        
        // Data
        this.priceData = [];
        this.trades = [];
        this.baselinePrice = 0;
        
        // State
        this.hoveredPoint = null;
        this.hoveredTrade = null;
        
        // Setup
        this.setupCanvas();
        this.setupEventListeners();
    }
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        
        this.width = rect.width;
        this.height = rect.height;
        this.chartWidth = this.width - this.padding.left - this.padding.right;
        this.chartHeight = this.height - this.padding.top - this.padding.bottom;
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
        
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
    }
    
    priceToY(price) {
        const range = this.maxPrice - this.minPrice;
        const normalized = (price - this.minPrice) / range;
        return this.padding.top + this.chartHeight * (1 - normalized);
    }
    
    timeToX(timestamp) {
        const range = this.maxTime - this.minTime;
        const normalized = (timestamp - this.minTime) / range;
        return this.padding.left + this.chartWidth * normalized;
    }
    
    xToTime(x) {
        const normalized = (x - this.padding.left) / this.chartWidth;
        return this.minTime + normalized * (this.maxTime - this.minTime);
    }
    
    yToPrice(y) {
        const normalized = 1 - (y - this.padding.top) / this.chartHeight;
        return this.minPrice + normalized * (this.maxPrice - this.minPrice);
    }
    
    setData(priceData, trades = []) {
        this.priceData = priceData;
        this.trades = trades;
        
        if (priceData.length === 0) {
            this.drawEmpty();
            return;
        }
        
        // Calculate bounds
        const prices = priceData.map(d => d.p || d.price);
        const times = priceData.map(d => d.t || d.timestamp);
        
        this.minPrice = Math.min(...prices);
        this.maxPrice = Math.max(...prices);
        this.minTime = Math.min(...times);
        this.maxTime = Math.max(...times);
        
        // Add 5% padding to price range
        const pricePadding = (this.maxPrice - this.minPrice) * 0.05 || 10;
        this.minPrice -= pricePadding;
        this.maxPrice += pricePadding;
        
        // Set baseline as first price
        this.baselinePrice = prices[0];
        
        this.draw();
    }
    
    drawEmpty() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.fillStyle = this.colors.textMuted;
        this.ctx.font = '14px JetBrains Mono, monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('No data for this day', this.width / 2, this.height / 2);
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (this.priceData.length === 0) {
            this.drawEmpty();
            return;
        }
        
        this.drawGrid();
        this.drawBaseline();
        this.drawGradientFill();
        this.drawPriceLine();
        this.drawYAxis();
        this.drawXAxis();
        this.drawTrades();
        this.drawCurrentPrice();
    }
    
    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        
        const priceStep = this.calculateNiceStep(this.maxPrice - this.minPrice, 5);
        const startPrice = Math.ceil(this.minPrice / priceStep) * priceStep;
        
        for (let price = startPrice; price <= this.maxPrice; price += priceStep) {
            const y = this.priceToY(price);
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding.left, y);
            this.ctx.lineTo(this.width - this.padding.right, y);
            this.ctx.stroke();
        }
    }
    
    drawBaseline() {
        const y = this.priceToY(this.baselinePrice);
        
        this.ctx.strokeStyle = this.colors.baseline;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding.left, y);
        this.ctx.lineTo(this.width - this.padding.right, y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = this.colors.textMuted;
        this.ctx.font = '11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.formatPrice(this.baselinePrice), this.width - this.padding.right + 8, y + 4);
    }
    
    drawGradientFill() {
        if (this.priceData.length < 2) return;
        
        const baselineY = this.priceToY(this.baselinePrice);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.timeToX(this.priceData[0].t || this.priceData[0].timestamp), baselineY);
        
        const firstY = this.priceToY(this.priceData[0].p || this.priceData[0].price);
        this.ctx.lineTo(this.timeToX(this.priceData[0].t || this.priceData[0].timestamp), firstY);
        
        for (let i = 1; i < this.priceData.length; i++) {
            const x = this.timeToX(this.priceData[i].t || this.priceData[i].timestamp);
            const y = this.priceToY(this.priceData[i].p || this.priceData[i].price);
            this.ctx.lineTo(x, y);
        }
        
        const lastPoint = this.priceData[this.priceData.length - 1];
        const lastX = this.timeToX(lastPoint.t || lastPoint.timestamp);
        this.ctx.lineTo(lastX, baselineY);
        this.ctx.closePath();
        
        const gradient = this.ctx.createLinearGradient(0, this.padding.top, 0, this.height - this.padding.bottom);
        gradient.addColorStop(0, this.colors.greenFill);
        gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, this.colors.redFill);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
    }
    
    drawPriceLine() {
        if (this.priceData.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.line;
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        
        const firstPoint = this.priceData[0];
        this.ctx.moveTo(
            this.timeToX(firstPoint.t || firstPoint.timestamp), 
            this.priceToY(firstPoint.p || firstPoint.price)
        );
        
        for (let i = 1; i < this.priceData.length; i++) {
            const point = this.priceData[i];
            const x = this.timeToX(point.t || point.timestamp);
            const y = this.priceToY(point.p || point.price);
            this.ctx.lineTo(x, y);
        }
        
        this.ctx.stroke();
    }
    
    drawYAxis() {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'left';
        
        const priceStep = this.calculateNiceStep(this.maxPrice - this.minPrice, 5);
        const startPrice = Math.ceil(this.minPrice / priceStep) * priceStep;
        
        for (let price = startPrice; price <= this.maxPrice; price += priceStep) {
            const y = this.priceToY(price);
            this.ctx.fillText(this.formatPrice(price), this.width - this.padding.right + 8, y + 4);
        }
    }
    
    drawXAxis() {
        this.ctx.fillStyle = this.colors.text;
        this.ctx.font = '11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'center';
        
        // For 24-hour view, show hours
        const hourMs = 60 * 60 * 1000;
        const rangeMs = this.maxTime - this.minTime;
        
        // Determine step based on range
        let stepMs = hourMs * 4; // Every 4 hours by default
        if (rangeMs < hourMs * 6) stepMs = hourMs; // If < 6 hours, every hour
        if (rangeMs < hourMs * 2) stepMs = hourMs / 2; // If < 2 hours, every 30 min
        
        let current = Math.ceil(this.minTime / stepMs) * stepMs;
        
        while (current <= this.maxTime) {
            const x = this.timeToX(current);
            if (x >= this.padding.left && x <= this.width - this.padding.right) {
                const date = new Date(current);
                const label = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                this.ctx.fillText(label, x, this.height - this.padding.bottom + 20);
            }
            current += stepMs;
        }
    }
    
    drawTrades() {
        for (const trade of this.trades) {
            const x = this.timeToX(trade.t || trade.timestamp);
            const y = this.priceToY(trade.price);
            
            if (x < this.padding.left || x > this.width - this.padding.right) continue;
            
            const color = trade.side === 'buy' ? this.colors.buy : this.colors.sell;
            const radius = 7;
            
            // Glow effect
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
            this.ctx.fillStyle = color + '33';
            this.ctx.fill();
            
            // Outer ring
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = color;
            this.ctx.fill();
            
            // Inner dot
            this.ctx.beginPath();
            this.ctx.arc(x, y, radius - 3, 0, Math.PI * 2);
            this.ctx.fillStyle = '#0d1117';
            this.ctx.fill();
        }
    }
    
    drawCurrentPrice() {
        if (this.priceData.length === 0) return;
        
        const lastPoint = this.priceData[this.priceData.length - 1];
        const price = lastPoint.p || lastPoint.price;
        const y = this.priceToY(price);
        const x = this.width - this.padding.right;
        
        const isUp = price >= this.baselinePrice;
        const color = isUp ? this.colors.green : this.colors.red;
        
        this.ctx.fillStyle = color;
        const tagWidth = 70;
        const tagHeight = 22;
        this.roundRect(x + 4, y - tagHeight / 2, tagWidth, tagHeight, 4);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.formatPrice(price), x + 10, y + 4);
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (x < this.padding.left || x > this.width - this.padding.right ||
            y < this.padding.top || y > this.height - this.padding.bottom) {
            this.hideTooltip();
            return;
        }
        
        const timestamp = this.xToTime(x);
        let nearestPoint = null;
        let nearestDistance = Infinity;
        
        for (const point of this.priceData) {
            const t = point.t || point.timestamp;
            const distance = Math.abs(t - timestamp);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPoint = point;
            }
        }
        
        let nearestTrade = null;
        for (const trade of this.trades) {
            const tradeX = this.timeToX(trade.t || trade.timestamp);
            const tradeY = this.priceToY(trade.price);
            const distance = Math.sqrt((x - tradeX) ** 2 + (y - tradeY) ** 2);
            if (distance < 15) {
                nearestTrade = trade;
                break;
            }
        }
        
        if (nearestPoint) {
            this.showTooltip(e.clientX, e.clientY, nearestPoint, nearestTrade);
        }
    }
    
    showTooltip(mouseX, mouseY, point, trade = null) {
        const price = point.p || point.price;
        const timestamp = point.t || point.timestamp;
        const date = new Date(timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let html = `
            <div class="price">$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="time">${timeStr}</div>
        `;
        
        if (trade) {
            const sideLabel = trade.side === 'buy' ? 'BUY' : 'SELL';
            const amount = trade.usdValue ? `$${trade.usdValue.toFixed(2)}` : '';
            html += `<div class="trade-info ${trade.side}">${sideLabel} ${amount}</div>`;
        }
        
        this.tooltip.innerHTML = html;
        this.tooltip.classList.add('visible');
        
        const rect = this.canvas.getBoundingClientRect();
        let tooltipX = mouseX - rect.left + 15;
        let tooltipY = mouseY - rect.top - 10;
        
        const tooltipRect = this.tooltip.getBoundingClientRect();
        if (tooltipX + tooltipRect.width > this.width) {
            tooltipX = mouseX - rect.left - tooltipRect.width - 15;
        }
        
        this.tooltip.style.left = tooltipX + 'px';
        this.tooltip.style.top = tooltipY + 'px';
    }
    
    hideTooltip() {
        this.tooltip.classList.remove('visible');
    }
    
    calculateNiceStep(range, targetSteps) {
        const roughStep = range / targetSteps;
        const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        const normalized = roughStep / magnitude;
        
        let niceStep;
        if (normalized <= 1.5) niceStep = 1;
        else if (normalized <= 3) niceStep = 2;
        else if (normalized <= 7) niceStep = 5;
        else niceStep = 10;
        
        return niceStep * magnitude;
    }
    
    formatPrice(price) {
        if (price >= 10000) {
            return '$' + (price / 1000).toFixed(1) + 'k';
        }
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }
}

// ============================================
// Carousel Controller
// ============================================
class CarouselController {
    constructor(chart) {
        this.chart = chart;
        this.availableDays = [];
        this.currentDayIndex = 0;
        this.currentDay = null;
        this.isLive = false;
        this.pollInterval = null;
        this.dayCache = {};
        
        // DOM elements
        this.prevBtn = document.getElementById('prev-day');
        this.nextBtn = document.getElementById('next-day');
        this.dateLabel = document.getElementById('date-label');
        this.dateStatus = document.getElementById('date-status');
        this.loading = document.getElementById('loading');
        this.dayIndicators = document.getElementById('day-indicators');
        this.connectionStatus = document.getElementById('connection-status');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.navigatePrev());
        this.nextBtn.addEventListener('click', () => this.navigateNext());
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') this.navigatePrev();
            if (e.key === 'ArrowRight') this.navigateNext();
        });
    }
    
    async start() {
        this.showLoading(true);
        await this.fetchData();
        this.startPolling();
    }
    
    async fetchData() {
        try {
            const response = await fetch(CONFIG.dataUrl + '?t=' + Date.now());
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.handleData(data);
            this.setConnectionStatus('connected', 'Live');
            
        } catch (error) {
            console.warn('Failed to fetch data:', error.message);
            this.setConnectionStatus('waiting', 'Waiting for backend...');
            
            // Retry after delay
            setTimeout(() => this.fetchData(), CONFIG.retryIntervalMs);
        }
    }
    
    handleData(data) {
        this.showLoading(false);
        
        // Update available days
        if (data.availableDays && data.availableDays.length > 0) {
            this.availableDays = data.availableDays;
            this.currentDay = data.currentDay;
            this.currentDayIndex = this.availableDays.indexOf(data.currentDay);
            if (this.currentDayIndex === -1) {
                this.currentDayIndex = this.availableDays.length - 1;
            }
        } else if (data.currentDay) {
            this.availableDays = [data.currentDay];
            this.currentDay = data.currentDay;
            this.currentDayIndex = 0;
        }
        
        // Cache current day data
        if (data.prices) {
            this.dayCache[data.currentDay] = {
                prices: data.prices,
                trades: data.trades || []
            };
        }
        
        // If viewing the current (live) day, update chart
        if (this.currentDayIndex === this.availableDays.length - 1) {
            this.isLive = true;
            this.updateChart(data.prices || [], data.trades || []);
        }
        
        this.updateUI();
    }
    
    updateChart(prices, trades) {
        // Transform data format if needed
        const priceData = prices.map(p => ({
            timestamp: p.t || p.timestamp,
            price: p.p || p.price
        }));
        
        const tradeData = trades.map(t => ({
            timestamp: t.t || t.timestamp,
            price: t.price,
            side: t.side,
            usdValue: t.usdValue
        }));
        
        this.chart.setData(priceData, tradeData);
        this.updateStats(priceData, tradeData);
    }
    
    updateStats(prices, trades) {
        if (prices.length === 0) return;
        
        const priceValues = prices.map(d => d.price);
        const currentPrice = priceValues[priceValues.length - 1];
        const highPrice = Math.max(...priceValues);
        const lowPrice = Math.min(...priceValues);
        
        document.getElementById('current-price').textContent = 
            '$' + currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('high-price').textContent = 
            '$' + highPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        document.getElementById('low-price').textContent = 
            '$' + lowPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const buyCount = trades.filter(t => t.side === 'buy').length;
        const sellCount = trades.filter(t => t.side === 'sell').length;
        document.getElementById('buy-count').textContent = buyCount;
        document.getElementById('sell-count').textContent = sellCount;
    }
    
    updateUI() {
        // Update date label
        const currentDay = this.availableDays[this.currentDayIndex];
        if (currentDay) {
            const date = new Date(currentDay + 'T12:00:00');
            this.dateLabel.textContent = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } else {
            this.dateLabel.textContent = 'No Data';
        }
        
        // Update status
        this.isLive = this.currentDayIndex === this.availableDays.length - 1;
        if (this.isLive) {
            this.dateStatus.textContent = 'LIVE';
            this.dateStatus.className = 'date-status live';
        } else {
            this.dateStatus.textContent = '24h snapshot';
            this.dateStatus.className = 'date-status';
        }
        
        // Update navigation buttons
        this.prevBtn.disabled = this.currentDayIndex <= 0;
        this.nextBtn.disabled = this.currentDayIndex >= this.availableDays.length - 1;
        
        // Update day indicators
        this.updateDayIndicators();
    }
    
    updateDayIndicators() {
        this.dayIndicators.innerHTML = '';
        
        for (let i = 0; i < this.availableDays.length; i++) {
            const dot = document.createElement('div');
            dot.className = 'day-dot' + (i === this.currentDayIndex ? ' active' : '');
            dot.title = this.availableDays[i];
            dot.addEventListener('click', () => this.navigateTo(i));
            this.dayIndicators.appendChild(dot);
        }
    }
    
    navigatePrev() {
        if (this.currentDayIndex > 0) {
            this.navigateTo(this.currentDayIndex - 1);
        }
    }
    
    navigateNext() {
        if (this.currentDayIndex < this.availableDays.length - 1) {
            this.navigateTo(this.currentDayIndex + 1);
        }
    }
    
    async navigateTo(index) {
        if (index < 0 || index >= this.availableDays.length) return;
        
        this.currentDayIndex = index;
        const day = this.availableDays[index];
        
        // Check cache
        if (this.dayCache[day]) {
            this.updateChart(this.dayCache[day].prices, this.dayCache[day].trades);
        } else {
            // Fetch day data
            this.showLoading(true);
            await this.fetchDayData(day);
        }
        
        this.updateUI();
    }
    
    async fetchDayData(day) {
        try {
            const response = await fetch(`./data/${day}.json?t=` + Date.now());
            if (response.ok) {
                const data = await response.json();
                this.dayCache[day] = {
                    prices: data.prices || [],
                    trades: data.trades || []
                };
                this.updateChart(data.prices || [], data.trades || []);
            } else {
                // No data for this day
                this.chart.setData([], []);
            }
        } catch (error) {
            console.warn(`Failed to fetch data for ${day}:`, error.message);
            this.chart.setData([], []);
        }
        
        this.showLoading(false);
    }
    
    startPolling() {
        this.pollInterval = setInterval(async () => {
            // Only poll if viewing live day
            if (this.isLive) {
                await this.fetchData();
            }
        }, CONFIG.pollIntervalMs);
    }
    
    showLoading(show) {
        if (show) {
            this.loading.classList.remove('hidden');
        } else {
            this.loading.classList.add('hidden');
        }
    }
    
    setConnectionStatus(status, text) {
        this.connectionStatus.className = 'connection-status ' + status;
        this.connectionStatus.querySelector('.status-text').textContent = text;
    }
}

// ============================================
// Initialize
// ============================================
async function init() {
    const chart = new TrahnChart('chart');
    const carousel = new CarouselController(chart);
    
    await carousel.start();
}

document.addEventListener('DOMContentLoaded', init);
