
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

            // Update stats
            const totalWithEAN = products.filter(p => p.ean && p.ean.length === 13).length;
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
                <td>
                    <input class="input is-small" type="number" step="0.01" min="0"
                           value="${product.custoUnitario.toFixed(2)}"
                           onchange="updateProduct(${index}, 'custoUnitario', parseFloat(this.value))">
                </td>
                <td>
                    <input class="input is-small" type="number" step="0.01" min="0"
                           value="${product.precoVenda.toFixed(2)}"
                           onchange="updateProduct(${index}, 'precoVenda', parseFloat(this.value))">
                </td>
                <td>
                    <input class="input is-small ${markup >= 0 ? 'positive' : 'negative'}" 
                           type="number" step="0.01"
                           value="${markup.toFixed(2)}"
                           onchange="updateFromMarkup(${index}, parseFloat(this.value))">
                </td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <input class="input is-small ${margem >= 0 ? 'positive' : 'negative'}" 
                               type="number" step="0.01"
                               value="${margem.toFixed(2)}"
                               onchange="updateFromMargem(${index}, parseFloat(this.value))"
                               style="flex: 1;">
                        ${margemIndicator}
                    </div>
                </td>
                <td>
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

        function updateFromMarkup(index, markup) {
            const custo = products[index].custoUnitario;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateTable();
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

        // Initialize empty state
        updateTable();
    