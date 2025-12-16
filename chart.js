/**
 * TRAHN Grid Trader - Custom Canvas Chart
 * No dependencies. Pure JavaScript.
 */

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
        // Handle high DPI displays
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
        // Resize handler
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.draw();
        });
        
        // Mouse move for tooltip
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.hideTooltip());
    }
    
    // Convert price to Y coordinate
    priceToY(price) {
        const range = this.maxPrice - this.minPrice;
        const normalized = (price - this.minPrice) / range;
        return this.padding.top + this.chartHeight * (1 - normalized);
    }
    
    // Convert timestamp to X coordinate
    timeToX(timestamp) {
        const range = this.maxTime - this.minTime;
        const normalized = (timestamp - this.minTime) / range;
        return this.padding.left + this.chartWidth * normalized;
    }
    
    // Convert X coordinate to timestamp
    xToTime(x) {
        const normalized = (x - this.padding.left) / this.chartWidth;
        return this.minTime + normalized * (this.maxTime - this.minTime);
    }
    
    // Convert Y coordinate to price
    yToPrice(y) {
        const normalized = 1 - (y - this.padding.top) / this.chartHeight;
        return this.minPrice + normalized * (this.maxPrice - this.minPrice);
    }
    
    setData(priceData, trades = []) {
        this.priceData = priceData;
        this.trades = trades;
        
        if (priceData.length === 0) return;
        
        // Calculate bounds
        const prices = priceData.map(d => d.price);
        const times = priceData.map(d => d.timestamp);
        
        this.minPrice = Math.min(...prices);
        this.maxPrice = Math.max(...prices);
        this.minTime = Math.min(...times);
        this.maxTime = Math.max(...times);
        
        // Add 5% padding to price range
        const pricePadding = (this.maxPrice - this.minPrice) * 0.05;
        this.minPrice -= pricePadding;
        this.maxPrice += pricePadding;
        
        // Set baseline as first price
        this.baselinePrice = priceData[0].price;
        
        this.draw();
    }
    
    draw() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        if (this.priceData.length === 0) return;
        
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
        
        // Horizontal grid lines
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
        
        // Baseline label
        this.ctx.fillStyle = this.colors.textMuted;
        this.ctx.font = '11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.formatPrice(this.baselinePrice), this.width - this.padding.right + 8, y + 4);
    }
    
    drawGradientFill() {
        if (this.priceData.length < 2) return;
        
        const baselineY = this.priceToY(this.baselinePrice);
        
        // Draw filled area above baseline (green) and below (red)
        this.ctx.beginPath();
        this.ctx.moveTo(this.timeToX(this.priceData[0].timestamp), baselineY);
        
        // Line to first point
        const firstY = this.priceToY(this.priceData[0].price);
        this.ctx.lineTo(this.timeToX(this.priceData[0].timestamp), firstY);
        
        // Draw all points
        for (let i = 1; i < this.priceData.length; i++) {
            const x = this.timeToX(this.priceData[i].timestamp);
            const y = this.priceToY(this.priceData[i].price);
            this.ctx.lineTo(x, y);
        }
        
        // Close path back to baseline
        const lastX = this.timeToX(this.priceData[this.priceData.length - 1].timestamp);
        this.ctx.lineTo(lastX, baselineY);
        this.ctx.closePath();
        
        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, this.padding.top, 0, this.height - this.padding.bottom);
        gradient.addColorStop(0, this.colors.greenFill);
        gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, this.colors.redFill);
        
        this.ctx.fillStyle = gradient;
        this.ctx.fill();
        
        // Now draw separate green and red fills more precisely
        this.drawSplitFill();
    }
    
    drawSplitFill() {
        const baselineY = this.priceToY(this.baselinePrice);
        
        // Green fill (above baseline)
        this.ctx.beginPath();
        let started = false;
        
        for (let i = 0; i < this.priceData.length; i++) {
            const x = this.timeToX(this.priceData[i].timestamp);
            const y = this.priceToY(this.priceData[i].price);
            const clampedY = Math.max(y, this.padding.top);
            
            if (y <= baselineY) {
                if (!started) {
                    this.ctx.moveTo(x, baselineY);
                    started = true;
                }
                this.ctx.lineTo(x, Math.min(y, baselineY));
            } else if (started) {
                this.ctx.lineTo(x, baselineY);
            }
        }
        
        if (started) {
            this.ctx.lineTo(this.timeToX(this.priceData[this.priceData.length - 1].timestamp), baselineY);
            this.ctx.closePath();
            this.ctx.fillStyle = this.colors.greenFill;
            this.ctx.fill();
        }
        
        // Red fill (below baseline)
        this.ctx.beginPath();
        started = false;
        
        for (let i = 0; i < this.priceData.length; i++) {
            const x = this.timeToX(this.priceData[i].timestamp);
            const y = this.priceToY(this.priceData[i].price);
            
            if (y >= baselineY) {
                if (!started) {
                    this.ctx.moveTo(x, baselineY);
                    started = true;
                }
                this.ctx.lineTo(x, Math.max(y, baselineY));
            } else if (started) {
                this.ctx.lineTo(x, baselineY);
            }
        }
        
        if (started) {
            this.ctx.lineTo(this.timeToX(this.priceData[this.priceData.length - 1].timestamp), baselineY);
            this.ctx.closePath();
            this.ctx.fillStyle = this.colors.redFill;
            this.ctx.fill();
        }
    }
    
    drawPriceLine() {
        if (this.priceData.length < 2) return;
        
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.colors.line;
        this.ctx.lineWidth = 2;
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        
        const firstPoint = this.priceData[0];
        this.ctx.moveTo(this.timeToX(firstPoint.timestamp), this.priceToY(firstPoint.price));
        
        for (let i = 1; i < this.priceData.length; i++) {
            const point = this.priceData[i];
            const x = this.timeToX(point.timestamp);
            const y = this.priceToY(point.price);
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
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayMs = 24 * 60 * 60 * 1000;
        
        // Show day labels
        let currentDay = new Date(this.minTime).setHours(0, 0, 0, 0);
        
        while (currentDay <= this.maxTime) {
            const x = this.timeToX(currentDay);
            if (x >= this.padding.left && x <= this.width - this.padding.right) {
                const date = new Date(currentDay);
                const label = days[date.getDay()];
                this.ctx.fillText(label, x, this.height - this.padding.bottom + 20);
            }
            currentDay += dayMs;
        }
    }
    
    drawTrades() {
        for (const trade of this.trades) {
            const x = this.timeToX(trade.timestamp);
            const y = this.priceToY(trade.price);
            
            // Skip if outside chart bounds
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
        const y = this.priceToY(lastPoint.price);
        const x = this.width - this.padding.right;
        
        const isUp = lastPoint.price >= this.baselinePrice;
        const color = isUp ? this.colors.green : this.colors.red;
        
        // Price tag background
        this.ctx.fillStyle = color;
        const tagWidth = 70;
        const tagHeight = 22;
        this.roundRect(x + 4, y - tagHeight / 2, tagWidth, tagHeight, 4);
        this.ctx.fill();
        
        // Price text
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 11px JetBrains Mono, monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(this.formatPrice(lastPoint.price), x + 10, y + 4);
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Check if within chart area
        if (x < this.padding.left || x > this.width - this.padding.right ||
            y < this.padding.top || y > this.height - this.padding.bottom) {
            this.hideTooltip();
            return;
        }
        
        // Find nearest price point
        const timestamp = this.xToTime(x);
        let nearestPoint = null;
        let nearestDistance = Infinity;
        
        for (const point of this.priceData) {
            const distance = Math.abs(point.timestamp - timestamp);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestPoint = point;
            }
        }
        
        // Check for nearby trade
        let nearestTrade = null;
        for (const trade of this.trades) {
            const tradeX = this.timeToX(trade.timestamp);
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
        const date = new Date(point.timestamp);
        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let html = `
            <div class="price">$${point.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="time">${timeStr}</div>
        `;
        
        if (trade) {
            const sideLabel = trade.side === 'buy' ? 'BUY' : 'SELL';
            const amount = trade.amount ? `$${trade.amount.toFixed(2)}` : '';
            html += `<div class="trade-info ${trade.side}">${sideLabel} ${amount}</div>`;
        }
        
        this.tooltip.innerHTML = html;
        this.tooltip.classList.add('visible');
        
        // Position tooltip
        const rect = this.canvas.getBoundingClientRect();
        let tooltipX = mouseX - rect.left + 15;
        let tooltipY = mouseY - rect.top - 10;
        
        // Keep tooltip in bounds
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
    
    // Utility functions
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
// Data Fetching
// ============================================

async function fetchETHPriceHistory() {
    try {
        // CoinGecko API - 7 days of hourly data
        const response = await fetch(
            'https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=7'
        );
        const data = await response.json();
        
        // Transform to our format
        return data.prices.map(([timestamp, price]) => ({
            timestamp,
            price
        }));
    } catch (error) {
        console.error('Failed to fetch price data:', error);
        return [];
    }
}

async function fetchTrades() {
    // For now, return mock trades to demonstrate the dots
    // Later this will read from the backend state file
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    // Mock trades spread across the week
    return [
        { timestamp: now - 5 * day, price: 3180, side: 'buy', amount: 100 },
        { timestamp: now - 4.5 * day, price: 3220, side: 'sell', amount: 100 },
        { timestamp: now - 2 * day, price: 3050, side: 'buy', amount: 100 },
        { timestamp: now - 1 * day, price: 3150, side: 'sell', amount: 100 },
    ];
}

// ============================================
// Initialize
// ============================================

async function init() {
    const chart = new TrahnChart('chart');
    
    // Fetch data
    const priceData = await fetchETHPriceHistory();
    const trades = await fetchTrades();
    
    if (priceData.length === 0) {
        document.querySelector('.chart-container').innerHTML = 
            '<div class="loading">Failed to load price data</div>';
        return;
    }
    
    // Set data and draw
    chart.setData(priceData, trades);
    
    // Update stats
    const prices = priceData.map(d => d.price);
    const currentPrice = prices[prices.length - 1];
    const highPrice = Math.max(...prices);
    const lowPrice = Math.min(...prices);
    
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
    
    // Auto-refresh every 60 seconds
    setInterval(async () => {
        const newPriceData = await fetchETHPriceHistory();
        if (newPriceData.length > 0) {
            chart.setData(newPriceData, trades);
            
            const newPrices = newPriceData.map(d => d.price);
            const newCurrentPrice = newPrices[newPrices.length - 1];
            document.getElementById('current-price').textContent = 
                '$' + newCurrentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }, 60000);
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);

