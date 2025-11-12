
        let products = [];
        let productIdCounter = 1;
        let tributos2026Mode = false;
        let tributosDisabled = false;
        let customLabelsSelection = {}; // {productId: quantity}

        // Initialize
        document.getElementById('xmlFile').addEventListener('change', handleXMLUpload);
        
        function toggleTributos2026() {
            tributos2026Mode = document.getElementById('tributos2026Toggle').checked;
            const helpText = document.getElementById('tributosHelp');
            const badge = document.getElementById('tributosModeBadge');
            
            if (tributos2026Mode) {
                helpText.innerHTML = '<strong style="color: #059669;">✓ Modo 2026 Ativo:</strong> Usando IBS (26,5%) + CBS no lugar de ICMS, IPI, PIS e COFINS';
                badge.className = 'tributos-badge tributos-2026';
                badge.textContent = '2026';
                
                document.getElementById('semTributosToggle').checked = false;
                tributosDisabled = false;
            } else {
                helpText.innerHTML = '<strong>Modo Atual:</strong> Extrai ICMS, IPI, PIS, COFINS da NF-e | <strong>Modo 2026:</strong> IBS (26,5%) + CBS calculados automaticamente';
                badge.className = 'tributos-badge tributos-atual';
                badge.textContent = 'Atual';
            }
            
            products.forEach((product, index) => {
                recalculateTributos(index);
            });
            updateTable();
            
            showToast(tributos2026Mode ? 'Tributos 2026 ativados! IBS (26,5%) + CBS' : 'Tributos tradicionais ativados!');
        }
        
        function toggleSemTributos() {
            tributosDisabled = document.getElementById('semTributosToggle').checked;
            const helpText2 = document.getElementById('semTributosHelp');
            const badge = document.getElementById('tributosModeBadge');
            
            if (tributosDisabled) {
                helpText2.innerHTML = '<strong style="color: #dc2626;">✓ Tributos Desativados:</strong> Trabalhando sem tributos - Custo Base com Tributo = Custo Base';
                badge.className = 'tributos-badge';
                badge.style.background = '#6b7280';
                badge.textContent = 'Sem Tributos';
                
                document.getElementById('tributos2026Toggle').checked = false;
                tributos2026Mode = false;
            } else {
                helpText2.innerHTML = '<strong>Sem Tributos:</strong> Desativa cálculo de tributos (Custo Base com Tributo = Custo Base)';
                badge.className = 'tributos-badge tributos-atual';
                badge.textContent = 'Atual';
            }
            
            products.forEach((product, index) => {
                recalculateTributos(index);
            });
            updateTable();
            
            showToast(tributosDisabled ? 'Tributos desativados! Custo Base com Tributo = Custo Base' : 'Tributos reativados!');
        }

        function recalculateTributos(index) {
            const product = products[index];
            
            if (tributosDisabled) {
                product.tributos = 0;
                product.custoTotal = product.custoBase;
                product.subtotal = product.custoTotal * product.qtdEmbalagem;
                product.tributosDetalhes = {
                    modo: 'desativado'
                };
            } else if (tributos2026Mode) {
                const ibs = product.custoBase * 0.265;
                const cbs = 0;
                product.tributos = ibs + cbs;
                product.tributosDetalhes = {
                    modo: '2026',
                    ibs: ibs,
                    cbs: cbs
                };
                product.custoTotal = product.custoBase + product.tributos;
                product.subtotal = product.custoTotal * product.qtdEmbalagem;
            } else {
                if (product.tributosDetalhes && product.tributosDetalhes.modo === 'nfe') {
                    product.tributos = 
                        (product.tributosDetalhes.icms || 0) +
                        (product.tributosDetalhes.ipi || 0) +
                        (product.tributosDetalhes.pis || 0) +
                        (product.tributosDetalhes.cofins || 0);
                } else {
                    product.tributos = product.custoBase * 0.18;
                    product.tributosDetalhes = {
                        modo: 'estimado',
                        icms: product.custoBase * 0.12,
                        ipi: 0,
                        pis: product.custoBase * 0.0165,
                        cofins: product.custoBase * 0.076
                    };
                }
                product.custoTotal = product.custoBase + product.tributos;
                product.subtotal = product.custoTotal * product.qtdEmbalagem;
            }
        }

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
            const items = xmlDoc.getElementsByTagName('det');
            
            let count = 0;
            for (let item of items) {
                const prod = item.getElementsByTagName('prod')[0];
                if (!prod) continue;

                const descricao = getXMLValue(prod, 'xProd');
                const valorUnitario = parseFloat(getXMLValue(prod, 'vUnCom')) || 0;
                const quantidade = parseFloat(getXMLValue(prod, 'qCom')) || 1;
                const unidade = getXMLValue(prod, 'uCom') || 'UN';
                const ncm = getXMLValue(prod, 'NCM') || '';
                const ean = getXMLValue(prod, 'cEAN') || '';

                const imposto = item.getElementsByTagName('imposto')[0];
                let tributos = {
                    icms: 0,
                    ipi: 0,
                    pis: 0,
                    cofins: 0
                };

                if (imposto) {
                    const icms = imposto.getElementsByTagName('ICMS')[0];
                    if (icms) {
                        const icmsTypes = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90'];
                        for (let type of icmsTypes) {
                            const icmsTag = icms.getElementsByTagName(type)[0];
                            if (icmsTag) {
                                tributos.icms = parseFloat(getXMLValue(icmsTag, 'vICMS')) || 0;
                                break;
                            }
                        }
                    }

                    const ipi = imposto.getElementsByTagName('IPI')[0];
                    if (ipi) {
                        const ipiTrib = ipi.getElementsByTagName('IPITrib')[0];
                        if (ipiTrib) {
                            tributos.ipi = parseFloat(getXMLValue(ipiTrib, 'vIPI')) || 0;
                        }
                    }

                    const pis = imposto.getElementsByTagName('PIS')[0];
                    if (pis) {
                        const pisTypes = ['PISAliq', 'PISNT', 'PISQtde', 'PISOutr'];
                        for (let type of pisTypes) {
                            const pisTag = pis.getElementsByTagName(type)[0];
                            if (pisTag) {
                                tributos.pis = parseFloat(getXMLValue(pisTag, 'vPIS')) || 0;
                                break;
                            }
                        }
                    }

                    const cofins = imposto.getElementsByTagName('COFINS')[0];
                    if (cofins) {
                        const cofinsTypes = ['COFINSAliq', 'COFINSNT', 'COFINSQtde', 'COFINSOutr'];
                        for (let type of cofinsTypes) {
                            const cofinsTag = cofins.getElementsByTagName(type)[0];
                            if (cofinsTag) {
                                tributos.cofins = parseFloat(getXMLValue(cofinsTag, 'vCOFINS')) || 0;
                                break;
                            }
                        }
                    }
                }

                const totalTributosItem = tributos.icms + tributos.ipi + tributos.pis + tributos.cofins;
                const tributosUnitarios = quantidade > 0 ? totalTributosItem / quantidade : 0;
                const custoBase = valorUnitario;
                const unidadeNormalizada = normalizeUnit(unidade);
                const custoTotal = custoBase + tributosUnitarios;
                const subtotal = custoTotal * 1;

                addProductToList({
                    descricao: descricao,
                    ncm: ncm,
                    unidade: unidadeNormalizada,
                    qtdEmbalagem: 1,
                    custoBase: custoBase,
                    tributos: tributosUnitarios,
                    custoTotal: custoTotal,
                    subtotal: subtotal,
                    precoVenda: (custoTotal * 1.3).toFixed(2),
                    ean: ean && ean !== 'SEM GTIN' ? ean : '',
                    tributosDetalhes: {
                        modo: 'nfe',
                        icms: quantidade > 0 ? tributos.icms / quantidade : 0,
                        ipi: quantidade > 0 ? tributos.ipi / quantidade : 0,
                        pis: quantidade > 0 ? tributos.pis / quantidade : 0,
                        cofins: quantidade > 0 ? tributos.cofins / quantidade : 0
                    }
                });
                count++;
            }

            updateTable();
            if (count > 0) {
                showToast(`${count} produto(s) extraído(s) da NF-e com tributos!`);
            }
        }

        function normalizeUnit(unit) {
            if (!unit) return 'UN';
            const unitUpper = unit.toUpperCase().trim();
            const unitMap = {
                'UNIDADE': 'UN', 'UND': 'UN', 'UNID': 'UN',
                'PEÇA': 'PC', 'PECA': 'PC', 'PÇ': 'PC',
                'SACO': 'SC', 'PACOTE': 'PCT', 'DUZIA': 'DZ', 'DÚZIA': 'DZ',
                'METRO': 'M', 'METROS': 'M',
                'QUILO': 'KG', 'QUILOGRAMA': 'KG', 'QUILOGRAMAS': 'KG',
                'LITRO': 'L', 'LITROS': 'L',
                'MILILITRO': 'ML', 'MILILITROS': 'ML',
                'GALÃO': 'GALAO', 'GALAO': 'GALAO'
            };
            return unitMap[unitUpper] || unitUpper;
        }

        function getXMLValue(parent, tagName) {
            const element = parent.getElementsByTagName(tagName)[0];
            return element ? element.textContent : '';
        }

        function addProduct() {
            addProductToList({
                descricao: 'Novo Produto',
                ncm: '',
                unidade: 'UN',
                qtdEmbalagem: 1,
                custoBase: 0,
                tributos: 0,
                custoTotal: 0,
                subtotal: 0,
                precoVenda: '0.00',
                ean: ''
            });
            updateTable();
            showToast('Novo produto adicionado!');
        }

        function addProductToList(data) {
            const custoBase = parseFloat(data.custoBase) || 0;
            let tributos = parseFloat(data.tributos) || 0;
            
            if (tributos === 0 && custoBase > 0) {
                if (tributos2026Mode) {
                    tributos = custoBase * 0.265;
                } else {
                    tributos = custoBase * 0.18;
                }
            }
            
            const custoTotal = custoBase + tributos;
            const qtdEmbalagem = parseFloat(data.qtdEmbalagem) || 1;
            const subtotal = custoTotal * qtdEmbalagem;

            const product = {
                id: productIdCounter++,
                descricao: data.descricao || '',
                ncm: data.ncm || '',
                unidade: data.unidade || 'UN',
                qtdEmbalagem: qtdEmbalagem,
                custoBase: custoBase,
                tributos: tributos,
                custoTotal: custoTotal,
                subtotal: subtotal,
                precoVenda: parseFloat(data.precoVenda) || custoTotal * 1.3,
                ean: data.ean || '',
                selected: false,
                tributosDetalhes: data.tributosDetalhes || null
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

            updateStatistics();
        }

        function updateStatistics() {
            let totalCostBase = 0;
            let totalTributos = 0;
            let totalCost = 0;
            let totalSubtotal = 0;
            let totalRevenue = 0;
            let totalMarkup = 0;
            let totalMargin = 0;
            let totalWithEAN = 0;
            
            let tributosBreakdown = {
                icms: 0, ipi: 0, pis: 0, cofins: 0, ibs: 0, cbs: 0
            };

            products.forEach(product => {
                totalCostBase += product.custoBase;
                totalTributos += product.tributos;
                totalCost += product.custoTotal;
                totalSubtotal += product.subtotal;
                totalRevenue += product.precoVenda;
                totalMarkup += calculateMarkup(product.custoTotal, product.precoVenda);
                totalMargin += calculateMargem(product.custoTotal, product.precoVenda);
                
                if (product.ean && product.ean.length === 13) {
                    totalWithEAN++;
                }
                
                if (product.tributosDetalhes) {
                    if (product.tributosDetalhes.modo === '2026') {
                        tributosBreakdown.ibs += product.tributosDetalhes.ibs || 0;
                        tributosBreakdown.cbs += product.tributosDetalhes.cbs || 0;
                    } else {
                        tributosBreakdown.icms += product.tributosDetalhes.icms || 0;
                        tributosBreakdown.ipi += product.tributosDetalhes.ipi || 0;
                        tributosBreakdown.pis += product.tributosDetalhes.pis || 0;
                        tributosBreakdown.cofins += product.tributosDetalhes.cofins || 0;
                    }
                }
            });

            const totalProfit = totalRevenue - totalCost;
            const avgMargin = products.length > 0 ? totalMargin / products.length : 0;
            const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

            document.getElementById('totalCost').textContent = totalCost.toFixed(2);
            document.getElementById('totalSubtotal').textContent = totalSubtotal.toFixed(2);
            document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
            document.getElementById('totalTributos').textContent = totalTributos.toFixed(2);
            
            const breakdownEl = document.getElementById('tributosBreakdown');
            if (tributos2026Mode) {
                breakdownEl.innerHTML = `IBS: R$ ${tributosBreakdown.ibs.toFixed(2)} | CBS: R$ ${tributosBreakdown.cbs.toFixed(2)}`;
            } else {
                breakdownEl.innerHTML = `ICMS: R$ ${tributosBreakdown.icms.toFixed(2)} | IPI: R$ ${tributosBreakdown.ipi.toFixed(2)} | PIS: R$ ${tributosBreakdown.pis.toFixed(2)} | COFINS: R$ ${tributosBreakdown.cofins.toFixed(2)}`;
            }
            
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
            
            document.getElementById('avgMargin').textContent = avgMargin.toFixed(2);
            document.getElementById('totalProducts').textContent = products.length;
            document.getElementById('totalWithEAN').textContent = totalWithEAN;
            document.getElementById('totalWithoutEAN').textContent = products.length - totalWithEAN;
        }

        function createProductRow(product, index) {
            const row = document.createElement('tr');
            if (product.selected) row.classList.add('selected-row');

            const markup = calculateMarkup(product.custoTotal, product.precoVenda);
            const margem = calculateMargem(product.custoTotal, product.precoVenda);

            row.innerHTML = `
                <td class="no-print">
                    <input type="checkbox" ${product.selected ? 'checked' : ''} 
                           onchange="toggleProduct(${index})">
                </td>
                <td class="description-cell">
                    <input class="input is-small" type="text" 
                           value="${escapeHtml(product.descricao)}"
                           onchange="updateProduct(${index}, 'descricao', this.value)">
                </td>
                <td class="ncm-cell">
                    <input class="input is-small" type="text" 
                           value="${escapeHtml(product.ncm)}"
                           placeholder="NCM"
                           maxlength="8"
                           onchange="updateProduct(${index}, 'ncm', this.value)">
                </td>
                <td>
                    <select class="select is-small" 
                            onchange="updateProduct(${index}, 'unidade', this.value)">
                        <option value="UN" ${product.unidade === 'UN' ? 'selected' : ''}>UN</option>
                        <option value="PC" ${product.unidade === 'PC' ? 'selected' : ''}>PC</option>
                        <option value="CX" ${product.unidade === 'CX' ? 'selected' : ''}>CX</option>
                        <option value="KG" ${product.unidade === 'KG' ? 'selected' : ''}>KG</option>
                        <option value="L" ${product.unidade === 'L' ? 'selected' : ''}>L</option>
                        <option value="M" ${product.unidade === 'M' ? 'selected' : ''}>M</option>
                    </select>
                </td>
                <td>
                    <input class="input is-small" type="number" step="1" min="1"
                           value="${product.qtdEmbalagem}"
                           onchange="updateQtyEmbalagem(${index}, parseFloat(this.value))">
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.custoBase.toFixed(2)}"
                               onchange="updateCustoBase(${index}, parseFloat(this.value))">
                    </div>
                </td>
                <td style="background-color: #fef3c7;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol" style="color: #d97706;">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.tributos.toFixed(2)}"
                               onchange="updateTributos(${index}, parseFloat(this.value))"
                               style="font-weight: 600; color: #d97706; background-color: #fffbeb;"
                               ${tributosDisabled ? 'readonly' : ''}>
                    </div>
                </td>
                <td style="background-color: #fee2e2;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol" style="color: #dc2626;">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.custoTotal.toFixed(2)}"
                               readonly
                               style="font-weight: 600; color: #dc2626; background-color: #fef2f2;">
                    </div>
                </td>
                <td style="background-color: #e0e7ff;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol" style="color: #4c1d95;">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.subtotal.toFixed(2)}"
                               readonly
                               style="font-weight: 600; color: #4c1d95; background-color: #ede9fe;">
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.precoVenda.toFixed(2)}"
                               onchange="updateProduct(${index}, 'precoVenda', parseFloat(this.value))">
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input class="input is-small ${markup >= 0 ? 'positive' : 'negative'}" 
                               type="number" step="0.01"
                               value="${markup.toFixed(2)}"
                               onchange="updateFromMarkup(${index}, parseFloat(this.value))">
                        <span class="percent-symbol">%</span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <input class="input is-small ${margem >= 0 ? 'positive' : 'negative'}" 
                               type="number" step="0.01"
                               value="${margem.toFixed(2)}"
                               onchange="updateFromMargem(${index}, parseFloat(this.value))">
                        <span class="percent-symbol">%</span>
                    </div>
                </td>
                <td>
                    <div class="field has-addons" style="margin-bottom: 0;">
                        <div class="control is-expanded">
                            <input class="input is-small" type="text" 
                                   value="${product.ean}"
                                   placeholder="EAN-13"
                                   maxlength="13"
                                   onchange="updateProduct(${index}, 'ean', this.value)">
                        </div>
                        <div class="control no-print">
                            <button class="button is-small is-info" 
                                    onclick="generateEAN13(${index})">
                                <i class="fas fa-sync"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td class="barcode-cell">
                    <svg id="barcode-${product.id}"></svg>
                </td>
                <td class="no-print">
                    <button class="button is-small is-danger" 
                            onclick="deleteProduct(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;

            setTimeout(() => generateBarcode(product), 0);
            return row;
        }

        function updateQtyEmbalagem(index, qty) {
            if (isNaN(qty) || qty < 1) qty = 1;
            products[index].qtdEmbalagem = qty;
            products[index].subtotal = products[index].custoTotal * qty;
            updateTable();
        }

        function updateCustoBase(index, valor) {
            if (isNaN(valor)) return;
            products[index].custoBase = valor;
            recalculateTributos(index);
            updateTable();
        }
        
        function updateTributos(index, valor) {
            if (isNaN(valor)) return;
            products[index].tributos = valor;
            products[index].custoTotal = products[index].custoBase + valor;
            products[index].subtotal = products[index].custoTotal * products[index].qtdEmbalagem;
            products[index].tributosDetalhes = {
                modo: 'manual',
                valor: valor
            };
            updateTable();
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
            const custo = products[index].custoTotal;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateTable();
        }

        function updateFromMargem(index, margem) {
            const custo = products[index].custoTotal;
            if (margem >= 100) {
                showToast('Margem deve ser menor que 100%', 'danger');
                return;
            }
            products[index].precoVenda = custo / (1 - margem / 100);
            updateTable();
        }

        function generateEAN13(index) {
            let ean = '';
            for (let i = 0; i < 12; i++) {
                ean += Math.floor(Math.random() * 10);
            }
            
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
                'Unidade': p.unidade,
                'Qtd/Embalagem': p.qtdEmbalagem,
                'Custo Base': p.custoBase.toFixed(2),
                'Tributos': p.tributos.toFixed(2),
                'Custo Base com Tributo': p.custoTotal.toFixed(2),
                'Subtotal': p.subtotal.toFixed(2),
                'Preço Venda': p.precoVenda.toFixed(2),
                'Markup (%)': calculateMarkup(p.custoTotal, p.precoVenda).toFixed(2),
                'Margem (%)': calculateMargem(p.custoTotal, p.precoVenda).toFixed(2),
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

            const headers = ['Descrição', 'NCM', 'Unidade', 'Qtd/Embalagem', 'Custo Base', 'Tributos', 'Custo Base com Tributo', 'Subtotal', 'Preço Venda', 'Markup (%)', 'Margem (%)', 'Código EAN-13'];
            const rows = products.map(p => [
                `"${p.descricao.replace(/"/g, '""')}"`,
                p.ncm,
                p.unidade,
                p.qtdEmbalagem,
                p.custoBase.toFixed(2),
                p.tributos.toFixed(2),
                p.custoTotal.toFixed(2),
                p.subtotal.toFixed(2),
                p.precoVenda.toFixed(2),
                calculateMarkup(p.custoTotal, p.precoVenda).toFixed(2),
                calculateMargem(p.custoTotal, p.precoVenda).toFixed(2),
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

            event.target.value = '';
        }

        function importCSV(text) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                showToast('Arquivo CSV vazio ou inválido', 'danger');
                return;
            }

            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                if (cols.length >= 8) {
                    addProductToList({
                        descricao: cols[0],
                        ncm: cols[1] || '',
                        unidade: cols[2] || 'UN',
                        qtdEmbalagem: cols[3] || 1,
                        custoBase: cols[4],
                        tributos: cols[5],
                        custoTotal: cols[6],
                        subtotal: cols[7],
                        precoVenda: cols[8],
                        ean: cols[11] || ''
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
                    unidade: row['Unidade'] || 'UN',
                    qtdEmbalagem: row['Qtd/Embalagem'] || row['QtdEmbalagem'] || 1,
                    custoBase: row['Custo Base'] || row['Custo'] || 0,
                    tributos: row['Tributos'] || 0,
                    custoTotal: row['Custo Base com Tributo'] || row['Custo Total'] || 0,
                    subtotal: row['Subtotal'] || 0,
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
            
            generateLabels(products);
            
            setTimeout(() => {
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = document.getElementById('labelsPrintArea').innerHTML;
                
                previewContent.style.background = 'white';
                previewContent.querySelectorAll('.label-page').forEach(page => {
                    page.style.border = '2px solid #999';
                    page.style.marginBottom = '20px';
                    page.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    page.style.background = 'white';
                });
                
                document.getElementById('previewModal').classList.add('is-active');
            }, 1500);
        }

        function confirmPrintLabels() {
            closePreviewModal();
            showToast('Preparando impressão...', 'success');
            
            setTimeout(() => {
                document.body.classList.add('printing-labels');
                setTimeout(() => {
                    window.print();
                    setTimeout(() => {
                        document.body.classList.remove('printing-labels');
                    }, 200);
                }, 300);
            }, 500);
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closePrintModal();
                closePreviewModal();
                closeCustomLabelsModal();
            }
        });

        function printNormal() {
            closePrintModal();
            document.body.classList.remove('printing-labels');
            setTimeout(() => {
                window.print();
            }, 100);
        }

        function generateLabels(productsList) {
            const labelsPrintArea = document.getElementById('labelsPrintArea');
            labelsPrintArea.innerHTML = '';

            const itemsPerPage = 18;
            const pages = Math.ceil(productsList.length / itemsPerPage);

            for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
                const page = document.createElement('div');
                page.className = 'label-page';

                const start = pageIndex * itemsPerPage;
                const end = Math.min(start + itemsPerPage, productsList.length);

                for (let i = start; i < end; i++) {
                    const product = productsList[i];
                    const label = createLabelElement(product, pageIndex, i);
                    page.appendChild(label);
                }

                labelsPrintArea.appendChild(page);
            }
        }

        function createLabelElement(product, pageIndex, itemIndex) {
            const label = document.createElement('div');
            label.className = 'product-label';

            const description = document.createElement('div');
            description.className = 'label-description';
            description.textContent = `${product.descricao || 'Sem descrição'} - ${product.unidade || 'UN'}`;
            label.appendChild(description);

            const price = document.createElement('div');
            price.className = 'label-price';
            price.textContent = `R$ ${product.precoVenda.toFixed(2)}`;
            label.appendChild(price);

            const barcodeContainer = document.createElement('div');
            barcodeContainer.className = 'label-barcode';

            if (product.ean && product.ean.length === 13 && /^\d+$/.test(product.ean)) {
                const uniqueId = `barcode-p${pageIndex}-i${itemIndex}-${product.id}`;
                
                const canvas = document.createElement('canvas');
                canvas.setAttribute('id', uniqueId);
                barcodeContainer.appendChild(canvas);
                label.appendChild(barcodeContainer);

                try {
                    JsBarcode(canvas, product.ean, {
                        format: "EAN13",
                        width: 1.5,
                        height: 40,
                        displayValue: true,
                        fontSize: 10,
                        fontOptions: "bold",
                        font: "monospace",
                        textAlign: "center",
                        textMargin: 1,
                        margin: 2,
                        background: "#ffffff",
                        lineColor: "#000000"
                    });
                } catch (e) {
                    console.error('Erro ao gerar código de barras:', e);
                    barcodeContainer.innerHTML = `<div style="text-align: center; color: #000; font-size: 8pt; font-weight: bold;">||||| ${product.ean} |||||</div>`;
                }
            } else {
                const noBarcode = document.createElement('div');
                noBarcode.textContent = product.ean ? `EAN inválido: ${product.ean}` : 'Sem código EAN';
                noBarcode.style.textAlign = 'center';
                noBarcode.style.fontSize = '7pt';
                noBarcode.style.color = product.ean ? '#d32f2f' : '#666';
                barcodeContainer.appendChild(noBarcode);
                label.appendChild(barcodeContainer);
            }

            return label;
        }

        // Custom Labels Modal Functions
        function openCustomLabelsModal() {
            closePrintModal();
            
            if (products.length === 0) {
                showToast('Nenhum produto disponível', 'danger');
                return;
            }

            // Initialize selection from already selected products
            customLabelsSelection = {};
            products.forEach(product => {
                if (product.selected) {
                    customLabelsSelection[product.id] = 1;
                }
            });

            renderCustomLabelsList();
            document.getElementById('customLabelsModal').classList.add('is-active');
        }

        function closeCustomLabelsModal() {
            document.getElementById('customLabelsModal').classList.remove('is-active');
        }

        function renderCustomLabelsList() {
            const container = document.getElementById('customLabelsList');
            container.innerHTML = '';

            products.forEach(product => {
                const item = document.createElement('div');
                item.className = 'custom-label-item';
                if (customLabelsSelection[product.id]) {
                    item.classList.add('selected');
                }

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'custom-label-checkbox';
                checkbox.checked = !!customLabelsSelection[product.id];
                checkbox.onchange = () => toggleCustomLabel(product.id);

                const info = document.createElement('div');
                info.className = 'custom-label-info';

                const name = document.createElement('div');
                name.className = 'custom-label-name';
                name.textContent = product.descricao;

                const details = document.createElement('div');
                details.className = 'custom-label-details';
                details.innerHTML = `
                    <strong>${product.unidade}</strong> | 
                    R$ ${product.precoVenda.toFixed(2)} | 
                    ${product.ean ? `EAN: ${product.ean}` : 'Sem EAN'}
                `;

                info.appendChild(name);
                info.appendChild(details);

                const quantityInput = document.createElement('input');
                quantityInput.type = 'number';
                quantityInput.className = 'input is-small custom-label-quantity';
                quantityInput.min = '1';
                quantityInput.max = '999';
                quantityInput.value = customLabelsSelection[product.id] || 1;
                quantityInput.onchange = (e) => updateCustomLabelQuantity(product.id, parseInt(e.target.value));
                quantityInput.disabled = !customLabelsSelection[product.id];

                item.appendChild(checkbox);
                item.appendChild(info);
                item.appendChild(quantityInput);

                container.appendChild(item);
            });

            updateCustomLabelsCount();
        }

        function toggleCustomLabel(productId) {
            if (customLabelsSelection[productId]) {
                delete customLabelsSelection[productId];
            } else {
                customLabelsSelection[productId] = 1;
            }
            renderCustomLabelsList();
        }

        function updateCustomLabelQuantity(productId, quantity) {
            if (quantity < 1) quantity = 1;
            if (quantity > 999) quantity = 999;
            
            if (customLabelsSelection[productId]) {
                customLabelsSelection[productId] = quantity;
                updateCustomLabelsCount();
            }
        }

        function updateCustomLabelsCount() {
            let total = 0;
            Object.values(customLabelsSelection).forEach(qty => {
                total += qty;
            });
            document.getElementById('customLabelsCount').textContent = total;
        }

        function selectAllCustomLabels() {
            products.forEach(product => {
                if (!customLabelsSelection[product.id]) {
                    customLabelsSelection[product.id] = 1;
                }
            });
            renderCustomLabelsList();
        }

        function deselectAllCustomLabels() {
            customLabelsSelection = {};
            renderCustomLabelsList();
        }

        function setQuantityForAll() {
            const qty = prompt('Digite a quantidade de etiquetas para todos os produtos selecionados:', '1');
            if (qty === null) return;
            
            const quantity = parseInt(qty);
            if (isNaN(quantity) || quantity < 1) {
                showToast('Quantidade inválida', 'danger');
                return;
            }

            Object.keys(customLabelsSelection).forEach(productId => {
                customLabelsSelection[productId] = quantity;
            });
            
            renderCustomLabelsList();
            showToast(`Quantidade ${quantity} aplicada para todos os selecionados!`);
        }

        function previewCustomLabels() {
            if (Object.keys(customLabelsSelection).length === 0) {
                showToast('Selecione pelo menos um produto', 'danger');
                return;
            }

            closeCustomLabelsModal();
            showToast('Gerando preview das etiquetas personalizadas...', 'success');

            // Build list of products with repetitions
            const labelsList = [];
            products.forEach(product => {
                const quantity = customLabelsSelection[product.id];
                if (quantity) {
                    for (let i = 0; i < quantity; i++) {
                        labelsList.push(product);
                    }
                }
            });

            generateLabels(labelsList);

            setTimeout(() => {
                const previewContent = document.getElementById('previewContent');
                previewContent.innerHTML = document.getElementById('labelsPrintArea').innerHTML;
                
                previewContent.style.background = 'white';
                previewContent.querySelectorAll('.label-page').forEach(page => {
                    page.style.border = '2px solid #999';
                    page.style.marginBottom = '20px';
                    page.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    page.style.background = 'white';
                });
                
                document.getElementById('previewModal').classList.add('is-active');
            }, 1500);
        }

        // Initialize empty state
        updateTable();
    