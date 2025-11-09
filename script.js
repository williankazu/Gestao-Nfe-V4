
        let products = [];
        let productIdCounter = 1;
        let tributos2026Mode = false;
        let tributosDisabled = false;

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
                
                // Desabilitar o toggle de sem tributos
                document.getElementById('semTributosToggle').checked = false;
                tributosDisabled = false;
            } else {
                helpText.innerHTML = '<strong>Modo Atual:</strong> Extrai ICMS, IPI, PIS, COFINS da NF-e | <strong>Modo 2026:</strong> IBS (26,5%) + CBS calculados automaticamente';
                badge.className = 'tributos-badge tributos-atual';
                badge.textContent = 'Atual';
            }
            
            // Recalcular todos os produtos com novo modo
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
                helpText2.innerHTML = '<strong style="color: #dc2626;">✓ Tributos Desativados:</strong> Trabalhando sem tributos - Custo Total = Custo Base';
                badge.className = 'tributos-badge';
                badge.style.background = '#6b7280';
                badge.textContent = 'Sem Tributos';
                
                // Desabilitar modo 2026
                document.getElementById('tributos2026Toggle').checked = false;
                tributos2026Mode = false;
            } else {
                helpText2.innerHTML = '<strong>Sem Tributos:</strong> Desativa cálculo de tributos (Custo Total = Custo Base)';
                badge.className = 'tributos-badge tributos-atual';
                badge.textContent = 'Atual';
            }
            
            // Recalcular todos os produtos
            products.forEach((product, index) => {
                recalculateTributos(index);
            });
            updateTable();
            
            showToast(tributosDisabled ? 'Tributos desativados! Custo Total = Custo Base' : 'Tributos reativados!');
        }

        function recalculateTributos(index) {
            const product = products[index];
            
            if (tributosDisabled) {
                // Sem tributos
                product.tributos = 0;
                product.custoTotal = product.custoBase;
                product.tributosDetalhes = {
                    modo: 'desativado'
                };
            } else if (tributos2026Mode) {
                // Reforma tributária 2026: IBS + CBS
                const ibs = product.custoBase * 0.265; // 26,5%
                const cbs = 0; // CBS ainda não definido, pode ser ajustado
                product.tributos = ibs + cbs;
                product.tributosDetalhes = {
                    modo: '2026',
                    ibs: ibs,
                    cbs: cbs
                };
                product.custoTotal = product.custoBase + product.tributos;
            } else {
                // Manter tributos originais da NF-e
                if (product.tributosDetalhes && product.tributosDetalhes.modo === 'nfe') {
                    // Já tem tributos da NF-e, manter
                    product.tributos = 
                        (product.tributosDetalhes.icms || 0) +
                        (product.tributosDetalhes.ipi || 0) +
                        (product.tributosDetalhes.pis || 0) +
                        (product.tributosDetalhes.cofins || 0);
                } else {
                    // Calcular tributos aproximados (18% padrão)
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

            // Parse NFe products (det elements)
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

                // Extrair tributos da NF-e
                const imposto = item.getElementsByTagName('imposto')[0];
                let tributos = {
                    icms: 0,
                    ipi: 0,
                    pis: 0,
                    cofins: 0
                };

                if (imposto) {
                    // ICMS
                    const icms = imposto.getElementsByTagName('ICMS')[0];
                    if (icms) {
                        // Pode ser ICMS00, ICMS10, ICMS20, etc.
                        const icmsTypes = ['ICMS00', 'ICMS10', 'ICMS20', 'ICMS30', 'ICMS40', 'ICMS51', 'ICMS60', 'ICMS70', 'ICMS90'];
                        for (let type of icmsTypes) {
                            const icmsTag = icms.getElementsByTagName(type)[0];
                            if (icmsTag) {
                                tributos.icms = parseFloat(getXMLValue(icmsTag, 'vICMS')) || 0;
                                break;
                            }
                        }
                    }

                    // IPI
                    const ipi = imposto.getElementsByTagName('IPI')[0];
                    if (ipi) {
                        const ipiTrib = ipi.getElementsByTagName('IPITrib')[0];
                        if (ipiTrib) {
                            tributos.ipi = parseFloat(getXMLValue(ipiTrib, 'vIPI')) || 0;
                        }
                    }

                    // PIS
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

                    // COFINS
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

                // Calcular tributos unitários
                // Os tributos na NF-e são totais do item, preciso dividir pela quantidade
                const totalTributosItem = tributos.icms + tributos.ipi + tributos.pis + tributos.cofins;
                const tributosUnitarios = quantidade > 0 ? totalTributosItem / quantidade : 0;
                
                // Custo base unitário (valor da NF-e)
                const custoBase = valorUnitario;
                
                // Normalizar unidade
                const unidadeNormalizada = normalizeUnit(unidade);

                // Calcular custo total unitário
                const custoTotal = custoBase + tributosUnitarios;

                addProductToList({
                    descricao: descricao,
                    ncm: ncm,
                    unidade: unidadeNormalizada,
                    qtdEmbalagem: 1,
                    custoBase: custoBase,
                    tributos: tributosUnitarios,
                    custoTotal: custoTotal,
                    precoVenda: (custoTotal * 1.3).toFixed(2), // 30% markup default sobre custo total
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
            
            // Mapeamento de unidades
            const unitMap = {
                'UNIDADE': 'UN',
                'UND': 'UN',
                'UNID': 'UN',
                'PEÇA': 'PC',
                'PECA': 'PC',
                'PÇ': 'PC',
                'SACO': 'SC',
                'PACOTE': 'PCT',
                'DUZIA': 'DZ',
                'DÚZIA': 'DZ',
                'METRO': 'M',
                'METROS': 'M',
                'QUILO': 'KG',
                'QUILOGRAMA': 'KG',
                'QUILOGRAMAS': 'KG',
                'LITRO': 'L',
                'LITROS': 'L',
                'MILILITRO': 'ML',
                'MILILITROS': 'ML',
                'GALÃO': 'GALAO',
                'GALAO': 'GALAO'
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
                precoVenda: '0.00',
                ean: ''
            });
            updateTable();
            showToast('Novo produto adicionado!');
        }

        function addProductToList(data) {
            const custoBase = parseFloat(data.custoBase) || 0;
            let tributos = parseFloat(data.tributos) || 0;
            
            // Se não tem tributos definidos, calcular
            if (tributos === 0 && custoBase > 0) {
                if (tributos2026Mode) {
                    tributos = custoBase * 0.265; // IBS 26,5%
                } else {
                    tributos = custoBase * 0.18; // Estimativa padrão
                }
            }
            
            const custoTotal = custoBase + tributos;

            const product = {
                id: productIdCounter++,
                descricao: data.descricao || '',
                ncm: data.ncm || '',
                unidade: data.unidade || 'UN',
                qtdEmbalagem: parseFloat(data.qtdEmbalagem) || 1,
                custoBase: custoBase,
                tributos: tributos,
                custoTotal: custoTotal,
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

            // Calculate and update statistics
            updateStatistics();
        }

        function updateStatistics() {
            let totalCostBase = 0;
            let totalTributos = 0;
            let totalCost = 0;
            let totalRevenue = 0;
            let totalMarkup = 0;
            let totalMargin = 0;
            let totalWithEAN = 0;
            
            let tributosBreakdown = {
                icms: 0,
                ipi: 0,
                pis: 0,
                cofins: 0,
                ibs: 0,
                cbs: 0
            };

            products.forEach(product => {
                totalCostBase += product.custoBase;
                totalTributos += product.tributos;
                totalCost += product.custoTotal;
                totalRevenue += product.precoVenda;
                totalMarkup += calculateMarkup(product.custoTotal, product.precoVenda);
                totalMargin += calculateMargem(product.custoTotal, product.precoVenda);
                
                if (product.ean && product.ean.length === 13) {
                    totalWithEAN++;
                }
                
                // Breakdown de tributos
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
            const avgMarkup = products.length > 0 ? totalMarkup / products.length : 0;
            const avgMargin = products.length > 0 ? totalMargin / products.length : 0;
            const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

            // Update DOM
            document.getElementById('totalCost').textContent = totalCost.toFixed(2);
            document.getElementById('totalRevenue').textContent = totalRevenue.toFixed(2);
            document.getElementById('totalTributos').textContent = totalTributos.toFixed(2);
            
            // Breakdown de tributos
            const breakdownEl = document.getElementById('tributosBreakdown');
            if (tributos2026Mode) {
                breakdownEl.innerHTML = `IBS: R$ ${tributosBreakdown.ibs.toFixed(2)} | CBS: R$ ${tributosBreakdown.cbs.toFixed(2)}`;
            } else {
                breakdownEl.innerHTML = `ICMS: R$ ${tributosBreakdown.icms.toFixed(2)} | IPI: R$ ${tributosBreakdown.ipi.toFixed(2)} | PIS: R$ ${tributosBreakdown.pis.toFixed(2)} | COFINS: R$ ${tributosBreakdown.cofins.toFixed(2)}`;
            }
            
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

            const markup = calculateMarkup(product.custoTotal, product.precoVenda);
            const margem = calculateMargem(product.custoTotal, product.precoVenda);
            
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
                <td class="unit-cell">
                    <select class="select is-small" 
                            onchange="updateProduct(${index}, 'unidade', this.value)"
                            style="width: 100%;">
                        <option value="UN" ${product.unidade === 'UN' ? 'selected' : ''}>UN</option>
                        <option value="PC" ${product.unidade === 'PC' ? 'selected' : ''}>PC</option>
                        <option value="CX" ${product.unidade === 'CX' ? 'selected' : ''}>CX</option>
                        <option value="SC" ${product.unidade === 'SC' ? 'selected' : ''}>SC</option>
                        <option value="PCT" ${product.unidade === 'PCT' ? 'selected' : ''}>PCT</option>
                        <option value="DZ" ${product.unidade === 'DZ' ? 'selected' : ''}>DZ</option>
                        <option value="FARDO" ${product.unidade === 'FARDO' ? 'selected' : ''}>FARDO</option>
                        <option value="TUBO" ${product.unidade === 'TUBO' ? 'selected' : ''}>TUBO</option>
                        <option value="BARRA" ${product.unidade === 'BARRA' ? 'selected' : ''}>BARRA</option>
                        <option value="M" ${product.unidade === 'M' ? 'selected' : ''}>METRO</option>
                        <option value="KG" ${product.unidade === 'KG' ? 'selected' : ''}>KG</option>
                        <option value="L" ${product.unidade === 'L' ? 'selected' : ''}>LITRO</option>
                        <option value="ML" ${product.unidade === 'ML' ? 'selected' : ''}>ML</option>
                        <option value="225ML" ${product.unidade === '225ML' ? 'selected' : ''}>225ML</option>
                        <option value="900ML" ${product.unidade === '900ML' ? 'selected' : ''}>900ML</option>
                        <option value="GALAO" ${product.unidade === 'GALAO' ? 'selected' : ''}>GALÃO</option>
                        <option value="LATA" ${product.unidade === 'LATA' ? 'selected' : ''}>LATA</option>
                        <option value="CENTO" ${product.unidade === 'CENTO' ? 'selected' : ''}>CENTO</option>
                    </select>
                </td>
                <td class="qty-cell">
                    <input class="input is-small" type="number" step="1" min="1"
                           value="${product.qtdEmbalagem}"
                           onchange="updateQtyEmbalagem(${index}, parseFloat(this.value))"
                           title="Qtd de unidades por embalagem">
                </td>
                <td class="cost-cell">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.custoBase.toFixed(2)}"
                               oninput="updateCustoBaseRealtime(${index}, parseFloat(this.value))"
                               onchange="updateCustoBase(${index}, parseFloat(this.value))"
                               style="flex: 1;">
                    </div>
                </td>
                <td class="price-cell" style="background-color: #fef3c7;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol" style="color: #d97706;">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.tributos.toFixed(2)}"
                               oninput="updateTributosRealtime(${index}, parseFloat(this.value))"
                               onchange="updateTributos(${index}, parseFloat(this.value))"
                               style="flex: 1; font-weight: 600; color: #d97706; background-color: #fffbeb;"
                               title="Tributos - Editável manualmente ou calculado automaticamente"
                               ${tributosDisabled ? 'readonly' : ''}>
                    </div>
                </td>
                <td class="cost-cell" style="background-color: #fee2e2;">
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span class="currency-symbol" style="color: #dc2626;">R$</span>
                        <input class="input is-small" type="number" step="0.01" min="0"
                               value="${product.custoTotal.toFixed(2)}"
                               readonly
                               style="flex: 1; font-weight: 600; color: #dc2626; background-color: #fef2f2;"
                               title="Custo Base + Tributos">
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

        function updateQtyEmbalagem(index, qty) {
            if (isNaN(qty) || qty < 1) qty = 1;
            products[index].qtdEmbalagem = qty;
            updateTable();
        }

        function updateCustoBase(index, valor) {
            if (isNaN(valor)) return;
            products[index].custoBase = valor;
            recalculateTributos(index);
            updateTable();
        }

        function updateCustoBaseRealtime(index, valor) {
            if (isNaN(valor)) return;
            products[index].custoBase = valor;
            recalculateTributos(index);
            updateRowCalculations(index);
        }
        
        function updateTributos(index, valor) {
            if (isNaN(valor)) return;
            products[index].tributos = valor;
            products[index].custoTotal = products[index].custoBase + valor;
            
            // Atualizar detalhes de tributos como manual
            products[index].tributosDetalhes = {
                modo: 'manual',
                valor: valor
            };
            
            updateTable();
        }

        function updateTributosRealtime(index, valor) {
            if (isNaN(valor)) return;
            products[index].tributos = valor;
            products[index].custoTotal = products[index].custoBase + valor;
            updateRowCalculations(index);
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
            const custo = products[index].custoTotal;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateTable();
        }

        function updateFromMarkupRealtime(index, markup) {
            if (isNaN(markup)) return;
            const custo = products[index].custoTotal;
            products[index].precoVenda = custo * (1 + markup / 100);
            updateRowCalculations(index);
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

        function updateFromMargemRealtime(index, margem) {
            if (isNaN(margem)) return;
            const custo = products[index].custoTotal;
            if (margem >= 100) {
                return;
            }
            products[index].precoVenda = custo / (1 - margem / 100);
            updateRowCalculations(index);
        }

        function updateRowCalculations(index) {
            const product = products[index];
            const markup = calculateMarkup(product.custoTotal, product.precoVenda);
            const margem = calculateMargem(product.custoTotal, product.precoVenda);
            
            // Find the row in the table
            const tbody = document.getElementById('productsTable');
            const row = tbody.children[index];
            
            if (!row) return;
            
            // Update custo base display (cell 5)
            const custoBaseInput = row.cells[5].querySelector('input');
            if (custoBaseInput && custoBaseInput !== document.activeElement) {
                custoBaseInput.value = product.custoBase.toFixed(2);
            }
            
            // Update tributos display (cell 6) - editável
            const tributosInput = row.cells[6].querySelector('input');
            if (tributosInput && tributosInput !== document.activeElement) {
                tributosInput.value = product.tributos.toFixed(2);
            }
            
            // Update custo total display (cell 7) - readonly
            const custoTotalInput = row.cells[7].querySelector('input');
            if (custoTotalInput) {
                custoTotalInput.value = product.custoTotal.toFixed(2);
            }
            
            // Update preco venda display (cell 8)
            const precoInput = row.cells[8].querySelector('input');
            if (precoInput && precoInput !== document.activeElement) {
                precoInput.value = product.precoVenda.toFixed(2);
            }
            
            // Update markup (cell 9)
            const markupInput = row.cells[9].querySelector('input');
            if (markupInput && markupInput !== document.activeElement) {
                markupInput.value = markup.toFixed(2);
                markupInput.className = `input is-small ${markup >= 0 ? 'positive' : 'negative'} value-updated`;
                setTimeout(() => markupInput.classList.remove('value-updated'), 500);
            }
            
            // Update margem (cell 10)
            const margemInput = row.cells[10].querySelector('input');
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
                'Unidade': p.unidade,
                'Qtd/Embalagem': p.qtdEmbalagem,
                'Custo Base': p.custoBase.toFixed(2),
                'Tributos': p.tributos.toFixed(2),
                'Custo Total': p.custoTotal.toFixed(2),
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

            const headers = ['Descrição', 'NCM', 'Unidade', 'Qtd/Embalagem', 'Custo Base', 'Tributos', 'Custo Total', 'Preço Venda', 'Markup (%)', 'Margem (%)', 'Código EAN-13'];
            const rows = products.map(p => [
                `"${p.descricao.replace(/"/g, '""')}"`,
                p.ncm,
                p.unidade,
                p.qtdEmbalagem,
                p.custoBase.toFixed(2),
                p.tributos.toFixed(2),
                p.custoTotal.toFixed(2),
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
                if (cols.length >= 7) {
                    addProductToList({
                        descricao: cols[0],
                        ncm: cols[1] || '',
                        unidade: cols[2] || 'UN',
                        qtdEmbalagem: cols[3] || 1,
                        custoBase: cols[4],
                        tributos: cols[5],
                        custoTotal: cols[6],
                        precoVenda: cols[7],
                        ean: cols[10] || ''
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
                    custoTotal: row['Custo Total'] || 0,
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

            console.log(`Gerando ${pages} página(s) de etiquetas para ${products.length} produtos`);

            for (let pageIndex = 0; pageIndex < pages; pageIndex++) {
                const page = document.createElement('div');
                page.className = 'label-page';

                const start = pageIndex * itemsPerPage;
                const end = Math.min(start + itemsPerPage, products.length);

                for (let i = start; i < end; i++) {
                    const product = products[i];
                    console.log(`Produto ${i+1}: ${product.descricao} - ${product.unidade}`);
                    const label = createLabelElement(product, pageIndex, i);
                    page.appendChild(label);
                }

                labelsPrintArea.appendChild(page);
            }
            
            console.log(`✓ ${pages} página(s) de etiquetas geradas com sucesso`);
        }

        function createLabelElement(product, pageIndex, itemIndex) {
            const label = document.createElement('div');
            label.className = 'product-label';

            // Descrição com unidade
            const description = document.createElement('div');
            description.className = 'label-description';
            const descText = product.descricao || 'Sem descrição';
            const unitText = product.unidade || 'UN';
            description.textContent = `${descText} - ${unitText}`;
            description.style.display = 'block';
            description.style.visibility = 'visible';
            label.appendChild(description);

            // Preço
            const price = document.createElement('div');
            price.className = 'label-price';
            price.textContent = `R$ ${product.precoVenda.toFixed(2)}`;
            price.style.display = 'block';
            price.style.visibility = 'visible';
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
                canvas.style.display = 'block';
                canvas.style.visibility = 'visible';
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
                        console.log(`✓ Etiqueta gerada: ${descText} - ${unitText} (${canvas.width}x${canvas.height})`);
                    } else {
                        console.warn(`⚠ Canvas vazio para: ${product.ean}`);
                    }
                } catch (e) {
                    console.error('❌ Erro ao gerar código de barras para:', product.descricao, e);
                    barcodeContainer.innerHTML = `<div style="text-align: center; color: #000; font-size: 9pt; font-weight: bold; font-family: monospace; display: block; visibility: visible;">
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
                noBarcode.style.display = 'block';
                noBarcode.style.visibility = 'visible';
                barcodeContainer.appendChild(noBarcode);
                label.appendChild(barcodeContainer);
            }

            return label;
        }

        // Initialize empty state
        updateTable();
    