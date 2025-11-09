
        let products = [];
        let productIdCounter = 1;

        // Initialize
        document.getElementById('xmlFile').addEventListener('change', handleXMLUpload);

        function handleXMLUpload(event) {
            const files = event.target.files;
            if (files.length === 0) return;

            document.getElementById('fileName').textContent = files.length === 1 
                ? files[0].name 
                : `${files.length} arquivos selecionados`;

            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => parseXML(e.target.result);
                reader.readAsText(file);
            });
        }

        function parseXML(xmlText) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");

            // Parse NFe products (det elements)
            const items = xmlDoc.getElementsByTagName('det');
            
            let count = 0;
            for (let item of items) {
                const prod = item.getElementsByTagName('prod')[0];
                if (!prod) continue;

                const descricao = getXMLValue(prod, 'xProd');
                const custoUnitario = parseFloat(getXMLValue(prod, 'vUnCom')) || 0;
                const ncm = getXMLValue(prod, 'NCM') || '';
                const ean = getXMLValue(prod, 'cEAN') || '';

                addProductToList({
                    descricao: descricao,
                    ncm: ncm,
                    custoUnitario: custoUnitario.toFixed(2),
                    precoVenda: (custoUnitario * 1.3).toFixed(2), // 30% markup default
                    ean: ean && ean !== 'SEM GTIN' ? ean : ''
                });
                count++;
            }

            updateTable();
            if (count > 0) {
                showToast(`${count} produto(s) extraído(s) da NF-e com sucesso!`);
            }
        }

        function getXMLValue(parent, tagName) {
            const element = parent.getElementsByTagName(tagName)[0];
            return element ? element.textContent : '';
        }

        function addProduct() {
            addProductToList({
                descricao: 'Novo Produto',
                ncm: '',
                custoUnitario: '0.00',
                precoVenda: '0.00',
                ean: ''
            });
            updateTable();
            showToast('Novo produto adicionado!');
        }

        function addProductToList(data) {
            const product = {
                id: productIdCounter++,
                descricao: data.descricao || '',
                ncm: data.ncm || '',
                custoUnitario: parseFloat(data.custoUnitario) || 0,
                precoVenda: parseFloat(data.precoVenda) || 0,
                ean: data.ean || '',
                selected: false
            };

            products.push(product);
        }

        function updateTable() {
            const tbody = document.getElementById('productsTable');
            const noProducts = document.getElementById('noProducts');
            const statsBox = document.getElementById('statsBox');

            if (products.length === 0) {
                tbody.innerHTML = '';
                noProducts.style.display = 'block';
                statsBox.style.display = 'none';
                return;
            }

            noProducts.style.display = 'none';
            statsBox.style.display = 'block';
            tbody.innerHTML = '';

            products.forEach((product, index) => {
                const row = createProductRow(product, index);
                tbody.appendChild(row);
            });

            // Calculate and update statistics
            updateStatistics();
        }

        function updateStatistics() {
            let totalCost = 0;
            let totalRevenue = 0;
            let totalMarkup = 0;
            let totalMargin = 0;
            let totalWithEAN = 0;

            products.forEach(product => {
                totalCost += product.custoUnitario;
                totalRevenue += product.precoVenda;
                totalMarkup += calculateMarkup(product.custoUnitario, product.precoVenda);
                totalMargin += calculateMargem(product.custoUnitario, product.precoVenda);
                
                if (product.ean && product.ean.length === 13) {
                    totalWithEAN++;
                }
            });

            const totalProfit = totalRevenue - totalCost;
            const avgMarkup = products.length > 0 ? totalMarkup / products.length : 0;
            const avgMargin = products.length > 0 ? totalMargin / products.length : 0;
            const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

            // Update DOM
            document.getElementById('totalCost').textContent = totalCost.toFixed(2);
            document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
            
            // Update profit with color indicator and icon
            const profitElement = document.getElementById('totalProfit');
            const profitCard = document.getElementById('profitCard');
            const profitIcon = document.getElementById('profitIcon');
            const profitLabel = document.getElementById('profitLabel');
            const profitPercentageElement = document.getElementById('profitPercentage');
            
            profitElement.textContent = Math.abs(totalProfit).toFixed(2);
            
            if (totalProfit >= 0) {
                profitCard.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                profitIcon.className = 'fas fa-trophy';
                profitLabel.textContent = 'Lucro Total Estimado';
                profitPercentageElement.innerHTML = `<i class="fas fa-arrow-up"></i> ${profitPercentage.toFixed(2)}% sobre o custo`;
            } else {
                profitCard.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                profitIcon.className = 'fas fa-exclamation-triangle';
                profitLabel.textContent = 'Prejuízo Total Estimado';
                profitPercentageElement.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(profitPercentage).toFixed(2)}% sobre o custo`;
            }
            
            document.getElementById('avgMarkup').textContent = avgMarkup.toFixed(2);
            document.getElementById('avgMargin').textContent = avgMargin.toFixed(2);
            document.getElementById('totalProducts').textContent = products.length;
            document.getElementById('totalWithEAN').textContent = totalWithEAN;
            document.getElementById('totalWithoutEAN').textContent = products.length - totalWithEAN;
        }

        function createProductRow(product, index) {
            const row = document.createElement('tr');
            if (product.selected) row.classList.add('selected-row');

            const markup = calculateMarkup(product.custoUnitario, product.precoVenda);
            const margem = calculateMargem(product.custoUnitario, product.precoVenda);
            
            // Indicadores visuais de margem
            let margemIndicator = '';
            if (margem >= 20) {
                margemIndicator = '<i class="fas fa-check-circle positive" style="margin-left: 5px;" title="Boa margem"></i>';
            } else if (margem < 10 && margem >= 0) {
                margemIndicator = '<i class="fas fa-exclamation-triangle" style="margin-left: 5px; color: #f59e0b;" title="Margem baixa"></i>';
            } else if (margem < 0) {
                margemIndicator = '<i class="fas fa-times-circle negative" style="margin-left: 5px;" title="Prejuízo"></i>';
            }

            row.innerHTML = `
                <td class="no-print">
                    <input type="checkbox" ${product.selected ? 'checked' : ''} 
                           onchange="toggleProduct(${index})">
                </td>
                <td class="description-cell">
                    <div class="description-wrapper">
                        <input class="input is-small" type="text" 
                               value="${escapeHtml(product.descricao)}"
                               onchange="updateProduct(${index}, 'descricao', this.value)"
                               style="flex: 1;">
                        <button class="button is-small is-ghost no-print copy-btn" 
                                onclick="copyField(${index}, 'descricao', 'Descrição')"
                                title="Copiar descrição">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td class="ncm-cell">
                    <div class="description-wrapper">
                        <input class="input is-small" type="text" 
                               value="${escapeHtml(product.ncm)}"
                               placeholder="NCM"
                               maxlength="8"
                               onchange="updateProduct(${index}, 'ncm', this.value)"
                               style="flex: 1;">
                        <button class="button is-small is-ghost no-print copy-btn" 
                                onclick="copyField(${index}, 'ncm', 'NCM')"
                                title="Copiar NCM"
                                ${!product.ncm ? 'disabled' : ''}>
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                </td>
                <td class="cost-cell">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.custoUnitario.toFixed(2)}"
                               oninput="updateProductRealtime(${index}, 'custoUnitario', parseFloat(this.value))"
                               onchange="updateProduct(${index}, 'custoUnitario', parseFloat(this.value))"
                               style="flex: 1;">
                    </div>
                </td>
                <td class="price-cell">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.precoVenda.toFixed(2)}"
                               oninput="updateProductRealtime(${index}, 'precoVenda', parseFloat(this.value))"
                               onchange="updateProduct(${index}, 'precoVenda', parseFloat(this.value))"
                               style="flex: 1;">
                    </div>
                </td>
                <td class="markup-cell">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input class="input is-small ${markup >= 0 ? 'positive' : 'negative'}" 
                               type="number" step="0.01"
                               value="${markup.toFixed(2)}"
                               oninput="updateFromMarkupRealtime(${index}, parseFloat(this.value))"
                               onchange="updateFromMarkup(${index}, parseFloat(this.value))"
                               style="flex: 1;">
                        <span class="percent-symbol">%</span>
                    </div>
                </td>
                <td class="margin-cell">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input class="input is-small ${margem >= 0 ? 'positive' : 'negative'}" 
                               type="number" step="0.01"
                               value="${margem.toFixed(2)}"
                               oninput="updateFromMargemRealtime(${index}, parseFloat(this.value))"
                               onchange="updateFromMargem(${index}, parseFloat(this.value))"
                               style="flex: 1;">
                        <span class="percent-symbol">%</span>
                        ${margemIndicator}
                    </div>
                </td>
                <td class="ean-cell">
                    <div class="field has-addons">
                        <div class="control is-expanded">
                            <input class="input is-small" type="text" 
                                   value="${product.ean}"
                                   placeholder="EAN-13"
                                   maxlength="13"
                                   onchange="updateProduct(${index}, 'ean', this.value)">
                        </div>
                        <div class="control no-print">
                            <button class="button is-small is-ghost copy-btn" 
                                    onclick="copyField(${index}, 'ean', 'EAN-13')"
                                    title="Copiar EAN-13"
                                    ${!product.ean ? 'disabled' : ''}>
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                        <div class="control no-print">
                            <button class="button is-small is-info" 
                                    onclick="generateEAN13(${index})"
                                    title="Gerar EAN-13">
                                <i class="fas fa-sync"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="barcode-cell">
                    <svg id="barcode-${product.id}"></svg>
                </td>
                <td class="no-print">
                    <div class="action-buttons">
                        <button class="button is-small is-danger" 
                                onclick="deleteProduct(${index})"
                                title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

            // Generate barcode after DOM insertion
            setTimeout(() => generateBarcode(product), 0);

            return row;
        }

        function calculateMarkup(custo, preco) {
            if (custo === 0) return 0;
            return ((preco - custo) / custo) * 100;
        }

        function calculateMargem(custo, preco) {
            if (preco === 0) return 0;
            return ((preco - custo) / preco) * 100;
        }

        function updateProduct(index, field, value) {
            products[index][field] = value;
            updateTable();
        }

        function updateProductRealtime(index, field, value) {
            if (isNaN(value)) return;
            products[index][field] = value;
            updateRowCalculations(index);
        }

        function updateFromMarkup(index, markup) {
            const custo = products[index].custoUnitario;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateTable();
        }

        function updateFromMarkupRealtime(index, markup) {
            if (isNaN(markup)) return;
            const custo = products[index].custoUnitario;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateRowCalculations(index);
        }

        function updateFromMargem(index, margem) {
            const custo = products[index].custoUnitario;
            if (margem >= 100) {
                showToast('Margem deve ser menor que 100%', 'danger');
                return;
            }
            products[index].precoVenda = custo / (1 - margem / 100);
            updateTable();
        }

        function updateFromMargemRealtime(index, margem) {
            if (isNaN(margem)) return;
            const custo = products[index].custoUnitario;
            if (margem >= 100) {
                return;
            }
            products[index].precoVenda = custo / (1 - margem / 100);
            updateRowCalculations(index);
        }

        function updateRowCalculations(index) {
            const product = products[index];
            const markup = calculateMarkup(product.custoUnitario, product.precoVenda);
            const margem = calculateMargem(product.custoUnitario, product.precoVenda);
            
            // Find the row in the table
            const tbody = document.getElementById('productsTable');
            const row = tbody.children[index];
            
            if (!row) return;
            
            // Update custo unitario display (cell 3)
            const custoInput = row.cells[3].querySelector('input');
            if (custoInput && custoInput !== document.activeElement) {
                custoInput.value = product.custoUnitario.toFixed(2);
                custoInput.classList.add('value-updated');
                setTimeout(() => custoInput.classList.remove('value-updated'), 500);
            }
            
            // Update preco venda display (cell 4)
            const precoInput = row.cells[4].querySelector('input');
            if (precoInput && precoInput !== document.activeElement) {
                precoInput.value = product.precoVenda.toFixed(2);
                precoInput.classList.add('value-updated');
                setTimeout(() => precoInput.classList.remove('value-updated'), 500);
            }
            
            // Update markup (cell 5)
            const markupInput = row.cells[5].querySelector('input');
            if (markupInput && markupInput !== document.activeElement) {
                markupInput.value = markup.toFixed(2);
                markupInput.className = `input is-small ${markup >= 0 ? 'positive' : 'negative'} value-updated`;
                setTimeout(() => markupInput.classList.remove('value-updated'), 500);
            }
            
            // Update margem (cell 6)
            const margemInput = row.cells[6].querySelector('input');
            if (margemInput && margemInput !== document.activeElement) {
                margemInput.value = margem.toFixed(2);
                margemInput.className = `input is-small ${margem >= 0 ? 'positive' : 'negative'} value-updated`;
                setTimeout(() => margemInput.classList.remove('value-updated'), 500);
            }
        }

        function generateEAN13(index) {
            // Generate a random EAN-13 (with proper check digit)
            let ean = '';
            for (let i = 0; i < 12; i++) {
                ean += Math.floor(Math.random() * 10);
            }
            
            // Calculate check digit
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(ean[i]) * (i % 2 === 0 ? 1 : 3);
            }
            const checkDigit = (10 - (sum % 10)) % 10;
            ean += checkDigit;

            products[index].ean = ean;
            updateTable();
            showToast('Código EAN-13 gerado com sucesso!');
        }

        function copyField(index, fieldName, displayName) {
            const text = products[index][fieldName];
            
            if (!text) {
                showToast(`${displayName} está vazio`, 'danger');
                return;
            }
            
            navigator.clipboard.writeText(text).then(() => {
                showToast(`${displayName} copiado com sucesso!`);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                showToast(`Erro ao copiar ${displayName}`, 'danger');
            });
        }

        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
            
            if (type === 'danger') {
                toast.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                toast.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
            }
            
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function generateBarcode(product) {
            const ean = product.ean;
            if (!ean || ean.length !== 13) {
                return;
            }

            try {
                JsBarcode(`#barcode-${product.id}`, ean, {
                    format: "EAN13",
                    width: 1,
                    height: 40,
                    displayValue: true,
                    fontSize: 12
                });
            } catch (e) {
                console.error('Erro ao gerar código de barras:', e);
            }
        }

        function toggleProduct(index) {
            products[index].selected = !products[index].selected;
            updateTable();
        }

        function toggleSelectAll() {
            const selectAll = document.getElementById('selectAll').checked;
            products.forEach(p => p.selected = selectAll);
            updateTable();
        }

        function deleteProduct(index) {
            if (confirm('Deseja realmente excluir este produto?')) {
                products.splice(index, 1);
                updateTable();
                showToast('Produto excluído com sucesso!');
            }
        }

        function deleteSelected() {
            const selected = products.filter(p => p.selected);
            if (selected.length === 0) {
                showToast('Nenhum produto selecionado', 'danger');
                return;
            }

            if (confirm(`Deseja excluir ${selected.length} produto(s) selecionado(s)?`)) {
                products = products.filter(p => !p.selected);
                updateTable();
                showToast(`${selected.length} produto(s) excluído(s) com sucesso!`);
            }
        }

        function exportToExcel() {
            if (products.length === 0) {
                showToast('Nenhum produto para exportar', 'danger');
                return;
            }

            const data = products.map(p => ({
                'Descrição': p.descricao,
                'NCM': p.ncm,
                'Custo Unitário': p.custoUnitario,
                'Preço Venda': p.precoVenda,
                'Markup (%)': calculateMarkup(p.custoUnitario, p.precoVenda).toFixed(2),
                'Margem (%)': calculateMargem(p.custoUnitario, p.precoVenda).toFixed(2),
                'Código EAN-13': p.ean
            }));

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Produtos");
            XLSX.writeFile(wb, `produtos_${new Date().toISOString().split('T')[0]}.xlsx`);
            showToast('Arquivo Excel exportado com sucesso!');
        }

        function exportToCSV() {
            if (products.length === 0) {
                showToast('Nenhum produto para exportar', 'danger');
                return;
            }

            const headers = ['Descrição', 'NCM', 'Custo Unitário', 'Preço Venda', 'Markup (%)', 'Margem (%)', 'Código EAN-13'];
            const rows = products.map(p => [
                `"${p.descricao.replace(/"/g, '""')}"`,
                p.ncm,
                p.custoUnitario.toFixed(2),
                p.precoVenda.toFixed(2),
                calculateMarkup(p.custoUnitario, p.precoVenda).toFixed(2),
                calculateMargem(p.custoUnitario, p.precoVenda).toFixed(2),
                p.ean
            ]);

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            showToast('Arquivo CSV exportado com sucesso!');
        }

        function importFile() {
            document.getElementById('importFile').click();
        }

        function handleImport(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    if (file.name.endsWith('.csv')) {
                        importCSV(e.target.result);
                    } else {
                        importExcel(e.target.result);
                    }
                } catch (error) {
                    showToast('Erro ao importar arquivo: ' + error.message, 'danger');
                }
            };

            if (file.name.endsWith('.csv')) {
                reader.readAsText(file);
            } else {
                reader.readAsBinaryString(file);
            }

            // Reset input
            event.target.value = '';
        }

        function importCSV(text) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                showToast('Arquivo CSV vazio ou inválido', 'danger');
                return;
            }

            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length >= 4) {
                    addProductToList({
                        descricao: cols[0],
                        ncm: cols[1] || '',
                        custoUnitario: cols[2],
                        precoVenda: cols[3],
                        ean: cols[6] || ''
                    });
                }
            }

            updateTable();
            showToast(`${lines.length - 1} produto(s) importado(s) com sucesso!`);
        }

        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);

            return result;
        }

        function importExcel(data) {
            const workbook = XLSX.read(data, { type: 'binary' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            jsonData.forEach(row => {
                addProductToList({
                    descricao: row['Descrição'] || row['Descricao'] || '',
                    ncm: row['NCM'] || '',
                    custoUnitario: row['Custo Unitário'] || row['Custo Unitario'] || row['Custo'] || 0,
                    precoVenda: row['Preço Venda'] || row['Preco Venda'] || row['Preço'] || 0,
                    ean: row['Código EAN-13'] || row['EAN-13'] || row['EAN'] || ''
                });
            });

            updateTable();
            showToast(`${jsonData.length} produto(s) importado(s) com sucesso!`);
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Print Modal Functions
        function openPrintModal() {
            if (products.length === 0) {
                showToast('Nenhum produto para imprimir', 'danger');
                return;
            }
            document.getElementById('printModal').classList.add('is-active');
        }

        function closePrintModal() {
            document.getElementById('printModal').classList.remove('is-active');
        }

        function closePreviewModal() {
            document.getElementById('previewModal').classList.remove('is-active');
        }

        function previewLabels() {
            closePrintModal();
            showToast('Gerando preview das etiquetas...', 'success');
            
            // Generate labels
            generateLabels();
            
            // Wait longer for barcodes to render completely
            setTimeout(() => {
                // Verify barcodes were generated
                const labelsPrintArea = document.getElementById('labelsPrintArea');
                const canvases = labelsPrintArea.querySelectorAll('canvas');
                const svgs = labelsPrintArea.querySelectorAll('svg');
                const totalBarcodes = canvases.length + svgs.length;
                console.log(`Total de códigos de barras gerados: ${totalBarcodes} (${canvases.length} canvas, ${svgs.length} svg)`);
                
                // Copy labels to preview
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = labelsPrintArea.innerHTML;
                
                // Add preview styles
                previewContent.style.background = 'white';
                previewContent.querySelectorAll('.label-page').forEach(page => {
                    page.style.border = '1px solid #ddd';
                    page.style.marginBottom = '20px';
                    page.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                });
                
                // Open preview modal
                document.getElementById('previewModal').classList.add('is-active');
                
                // Log verification
                const previewCanvases = previewContent.querySelectorAll('canvas');
                const previewSvgs = previewContent.querySelectorAll('svg');
                console.log(`Códigos de barras no preview: ${previewCanvases.length + previewSvgs.length}`);
            }, 1500);
        }

        function confirmPrintLabels() {
            closePreviewModal();
            showToast('Preparando impressão...', 'success');
            
            // Give extra time for browser to prepare print
            setTimeout(() => {
                document.body.classList.add('printing-labels');
                
                // Verify barcodes before printing
                const printArea = document.getElementById('labelsPrintArea');
                const canvases = printArea.querySelectorAll('canvas');
                const svgs = printArea.querySelectorAll('svg');
                const totalBarcodes = canvases.length + svgs.length;
                
                console.log(`Imprimindo ${totalBarcodes} códigos de barras (${canvases.length} canvas, ${svgs.length} svg)`);
                
                canvases.forEach((canvas, idx) => {
                    if (canvas.width === 0 || canvas.height === 0) {
                        console.warn(`Canvas ${idx} pode estar vazio`);
                    } else {
                        console.log(`Canvas ${idx}: ${canvas.width}x${canvas.height}`);
                    }
                });
                
                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        document.body.classList.remove('printing-labels');
                    }, 200);
                }, 300);
            }, 500);
        }

        // Close modal with ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closePrintModal();
                closePreviewModal();
            }
        });

        function printNormal() {
            closePrintModal();
            document.body.classList.remove('printing-labels');
            setTimeout(() => {
                window.print();
            }, 100);
        }

        function generateLabels() {
            const labelsPrintArea = document.getElementById('labelsPrintArea');
            labelsPrintArea.innerHTML = '';

            const itemsPerPage = 20;
            const pages = Math.ceil(products.length / itemsPerPage);

            for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
                const page = document.createElement('div');
                page.className = 'label-page';

                const start = pageIndex * itemsPerPage;
                const end = Math.min(start + itemsPerPage, products.length);

                for (let i = start; i < end; i++) {
                    const product = products[i];
                    const label = createLabelElement(product, pageIndex, i);
                    page.appendChild(label);
                }

                labelsPrintArea.appendChild(page);
            }
            
            console.log(`${pages} página(s) de etiquetas geradas com ${products.length} produtos`);
        }

        function createLabelElement(product, pageIndex, itemIndex) {
            const label = document.createElement('div');
            label.className = 'product-label';

            // Descrição
            const description = document.createElement('div');
            description.className = 'label-description';
            description.textContent = product.descricao || 'Sem descrição';
            label.appendChild(description);

            // Preço
            const price = document.createElement('div');
            price.className = 'label-price';
            price.textContent = `R$ ${product.precoVenda.toFixed(2)}`;
            label.appendChild(price);

            // Código de barras
            const barcodeContainer = document.createElement('div');
            barcodeContainer.className = 'label-barcode';

            if (product.ean && product.ean.length === 13 && /^\d+$/.test(product.ean)) {
                const uniqueId = `barcode-p${pageIndex}-i${itemIndex}-${product.id}`;
                
                // Try canvas first
                const canvas = document.createElement('canvas');
                canvas.setAttribute('id', uniqueId);
                canvas.style.maxWidth = '100%';
                canvas.style.height = 'auto';
                barcodeContainer.appendChild(canvas);
                label.appendChild(barcodeContainer);

                // Generate barcode using canvas
                try {
                    JsBarcode(canvas, product.ean, {
                        format: "EAN13",
                        width: 2,
                        height: 50,
                        displayValue: true,
                        fontSize: 12,
                        fontOptions: "bold",
                        font: "monospace",
                        textAlign: "center",
                        textMargin: 2,
                        margin: 5,
                        background: "#ffffff",
                        lineColor: "#000000",
                        valid: function(valid) {
                            if (!valid) {
                                console.error('EAN inválido:', product.ean);
                            }
                        }
                    });
                    
                    // Verify canvas has content
                    if (canvas.width > 0 && canvas.height > 0) {
                        console.log(`✓ Código de barras gerado: ${product.ean} (${canvas.width}x${canvas.height})`);
                    } else {
                        console.warn(`⚠ Canvas vazio para: ${product.ean}`);
                    }
                } catch (e) {
                    console.error('❌ Erro ao gerar código de barras para:', product.descricao, e);
                    barcodeContainer.innerHTML = `<div style="text-align: center; color: #000; font-size: 9pt; font-weight: bold; font-family: monospace;">
                        ||||| ${product.ean} |||||
                    </div>`;
                }
            } else {
                const noBarcode = document.createElement('div');
                if (product.ean) {
                    noBarcode.textContent = `EAN inválido: ${product.ean}`;
                    noBarcode.style.color = '#d32f2f';
                } else {
                    noBarcode.textContent = 'Sem código EAN';
                    noBarcode.style.color = '#666';
                }
                noBarcode.style.textAlign = 'center';
                noBarcode.style.fontSize = '8pt';
                noBarcode.style.padding = '5px';
                noBarcode.style.fontWeight = 'bold';
                barcodeContainer.appendChild(noBarcode);
                label.appendChild(barcodeContainer);
            }

            return label;
        }

        // Initialize empty state
        updateTable();
    