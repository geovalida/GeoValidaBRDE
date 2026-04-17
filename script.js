// JS extraído de v26.30 msg quando nao feitas validações ambientais.html
// Conteúdo dos <script>...</script> do HTML original (exceto imports de bibliotecas)
    // Orquestrador de análise ambiental em segundo plano
// ESTA LINHA É A MAIS IMPORTANTE: Ela declara a variável globalmente
let isAnalyzing = false; 

async function triggerBackgroundEnvironmentalAnalysis() {
    // Se já estiver analisando, não faz nada
    if (isAnalyzing) return;
    if (carCodeFeatures.length === 0) return;

    isAnalyzing = true;
    
    // Busca o botão e garante que ele mostre o estado de carregamento
    const envBtn = document.getElementById('btnRelatorio');
    if (envBtn) {
        envBtn.disabled = true;
        envBtn.innerHTML = '<i class="ph-spinner ph-spin"></i> Analisando CAR...';
    }

    try {
        // Busca propriedades oficiais caso não existam (Módulos Fiscais, etc)
        for (let i = 0; i < carCodes.length; i++) {
            if (!carProperties[i] || !carProperties[i].modulos_fiscais || carProperties[i].modulos_fiscais === 0) {
                try {
                    const officialData = await fetchSingleCar(carCodes[i]);
                    if (officialData) {
                        carProperties[i] = officialData.properties;
                        if (!carCodeFeatures[i]) carCodeFeatures[i] = officialData.feature;
                    }
                } catch (e) {
                    console.warn(`Não foi possível atualizar dados oficiais para o CAR ${carCodes[i]}`);
                }
            }
        }

        // Calcula a área de busca (BBOX)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        carCodeFeatures.forEach(feature => {
            try {
                const bbox = turf.bbox(feature);
                minX = Math.min(minX, bbox[0]); minY = Math.min(minY, bbox[1]);
                maxX = Math.max(maxX, bbox[2]); maxY = Math.max(maxY, bbox[3]);
            } catch (e) {}
        });
        
        // Executa a busca combinada (PRODES, UC, Florestas, MapBiomas, IBAMA)
        await fetchEnvironmentalDataCombined([minX, minY, maxX, maxY]);
        
    } catch (error) {
        console.error('Erro na análise completa:', error);
    } finally {
        // Volta o estado para falso para permitir novas análises no futuro
        isAnalyzing = false;
        
        // LIBERA O BOTÃO: Retorna ao estado original clicável
        if (envBtn) {
            envBtn.disabled = false;
            envBtn.innerHTML = '<i class="ph-file-text-fill"></i> Relatório de Análise Ambiental';
        }

        // LIMPA A MENSAGEM DO TOPO: Remove o texto "realizando análise ambiental..."
        const topMsg = document.getElementById('top-message-container');
        if (topMsg) {
            if (topMsg.innerHTML.includes('análise ambiental')) {
                topMsg.innerHTML = '';
            }
        }
    }
}
    function enableGlebaDeleteMode() {
        glebaDeleteHighlightLayers = [];
        leafletGlebaLayers.forEach((layer, idx) => {
            // Salva estilo antigo
            const oldStyle = layer.options && { ...layer.options };
            layer._oldStyleForDelete = oldStyle;
            layer.setStyle({ color: '#c62828', weight: 4, dashArray: '6', fillOpacity: 0.3 });
            // Handler de clique
            const handler = function(e) {
                if (deleteMode && !editingModeActive) {
                    // Previne propagação para evitar conflito com Leaflet.Draw
                    if (e && e.originalEvent) e.originalEvent.stopPropagation();
                    const currentIdx = leafletGlebaLayers.indexOf(layer);
                    if (currentIdx !== -1) {
                        removeGlebaByIndex(currentIdx);
                    }
                    disableGlebaDeleteMode();
                }
            };
            layer.on('click', handler);
            glebaDeleteHighlightLayers.push({ layer, handler });
        });
        // Muda cursor do mapa
        document.getElementById('map').style.cursor = 'not-allowed';
        // Mensagem visual
        document.getElementById('top-message-container').innerHTML = `<div class="warning-message"><i class="ph-trash"></i> Clique em uma gleba para excluí-la. Clique novamente no botão de lixeira para cancelar.</div>`;

    function disableGlebaDeleteMode() {
        deleteMode = false;
        glebaDeleteHighlightLayers.forEach(({ layer, handler }) => {
            if (layer._oldStyleForDelete) {
                layer.setStyle(layer._oldStyleForDelete);
                delete layer._oldStyleForDelete;
            }
            layer.off('click', handler);
        });
        glebaDeleteHighlightLayers = [];
        document.getElementById('map').style.cursor = '';
        document.getElementById('top-message-container').innerHTML = '';
        }
        // ...existing code...
    // Expor funções de exclusão individual no escopo global (após definição de todas as funções)
    window.removeGlebaByIndex = typeof removeGlebaByIndex !== 'undefined' ? removeGlebaByIndex : function(idx) { console.warn('removeGlebaByIndex não implementado'); };
    window.removeCarCode = typeof removeCarCode !== 'undefined' ? removeCarCode : function(idx) { console.warn('removeCarCode não implementado'); };
    window.removeCarFile = typeof removeCarFile !== 'undefined' ? removeCarFile : function(idx) { console.warn('removeCarFile não implementado'); };

    // Corrigir integração com Leaflet.Draw para exclusão nativa (apenas uma vez, fora das funções)
    if (typeof map !== 'undefined') {
        map.on('draw:deletestart', () => { editingModeActive = true; });
        map.on('draw:deletestop', () => { editingModeActive = false; });
        map.on('draw:deleted', function(e) {
            // Para cada layer deletado, remover do glebaData e leafletGlebaLayers
            if (e && e.layers) {
                e.layers.eachLayer(function(layer) {
                    const idx = leafletGlebaLayers.indexOf(layer);
                    if (idx !== -1) {
                        removeGlebaByIndex(idx);
                    }
                });
            }
        });
    }
    }


// Buscar embargos IBAMA via WFS e bbox
async function fetchIbamaEmbargosByBbox(bboxParam) {
    // Monta URL direta do IBAMA
    const directUrl = `https://siscom.ibama.gov.br/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=publica:vw_brasil_adm_embargo_a&outputFormat=application/json&bbox=${encodeURIComponent(bboxParam)}`;
    // URLs de fallback
    const localIbamaUrl = './ibama.json';
    const remoteIbamaUrl = 'https://validadorbrde.powerappsportals.com/Validador/ibama.json';
    let lastError = null;
    // Função para processar resposta e adicionar ao mapa
    async function processGeojsonResponse(response) {
        if (response && response.crs) delete response.crs;
        let geojson = response ? { ...response } : null;
        if (geojson && geojson.crs) delete geojson.crs;
        if (geojson && geojson.features && geojson.features.length > 0) {
            console.log('[IBAMA] GeoJSON retornado (sem crs):', geojson);
            if (typeof ibamaLayers !== 'undefined') {
                ibamaLayers.forEach(l => { if (map.hasLayer(l)) map.removeLayer(l); });
                ibamaLayers = [];
            }
            window.allIbamaEmbargos = geojson.features;
            const layer = L.geoJSON(geojson, {
                onEachFeature: function (feature, layer) {
                    layer.bindPopup('<b>Embargo IBAMA</b>');
                },
                style: { color: '#ff6600', weight: 2, fillOpacity: 0.2 }
            });
            ibamaLayers.push(layer);
            layer.addTo(map);
            if (typeof addLayerControl === 'function') addLayerControl();
            if (typeof updateLegend === 'function') updateLegend();
            return geojson.features;
        } else if (geojson && geojson.features && geojson.features.length === 0) {
            console.log('Nenhum embargo IBAMA encontrado para o bbox informado.');
            return [];
        } else {
            console.log('[IBAMA] Resposta recebida mas sem features:', geojson);
            return [];
        }
    }
    // 1. Tenta requisição direta
    try {
        console.log('Buscando embargos IBAMA (direto):', directUrl);
        const resp = await fetch(directUrl);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const response = await resp.json();
        return await processGeojsonResponse(response);
    } catch (err1) {
        lastError = err1;
        console.warn('Falha na requisição direta ao IBAMA:', err1);
        // 2. Fallback: tenta ibama.json local
        try {
            let respLocal = await fetch(localIbamaUrl); // tenta cache normal primeiro
            let responseLocal = null;
            if (respLocal.ok) {
                try {
                    responseLocal = await respLocal.json();
                } catch (e) {
                    responseLocal = null;
                }
                // Se vier vazio ou erro, força reload
                if (!responseLocal || !responseLocal.features) {
                    respLocal = await fetch(localIbamaUrl, { cache: 'reload' });
                    if (respLocal.ok) {
                        try {
                            responseLocal = await respLocal.json();
                        } catch (e) {
                            responseLocal = null;
                        }
                    }
                }
                if (responseLocal && responseLocal.features) {
                    return await processGeojsonResponse(responseLocal);
                } else {
                    throw new Error('ibama.json local não encontrado ou vazio');
                }
            } else {
                throw new Error('ibama.json local não encontrado');
            }
        } catch (errLocal) {
            console.warn('Erro ao buscar ibama.json local:', errLocal);
            // 3. Fallback: tenta ibama.json remoto
            try {
                let respRemote = await fetch(remoteIbamaUrl); // tenta cache normal primeiro
                let responseRemote = null;
                if (respRemote.ok) {
                    try {
                        responseRemote = await respRemote.json();
                    } catch (e) {
                        responseRemote = null;
                    }
                    // Se vier vazio ou erro, força reload
                    if (!responseRemote || !responseRemote.features) {
                        respRemote = await fetch(remoteIbamaUrl, { cache: 'reload' });
                        if (respRemote.ok) {
                            try {
                                responseRemote = await respRemote.json();
                            } catch (e) {
                                responseRemote = null;
                            }
                        }
                    }
                    if (responseRemote && responseRemote.features) {
                        return await processGeojsonResponse(responseRemote);
                    } else {
                        throw new Error('ibama.json remoto não encontrado ou vazio');
                    }
                } else {
                    throw new Error('ibama.json remoto não encontrado');
                }
            } catch (errRemote) {
                console.warn('Erro ao buscar ibama.json remoto:', errRemote);
                // Falhou tudo, retorna vazio
                return [];
            }
        }
    }
}
// Buscar PRODES poligonal local (UF_prodes.json) via bbox e UF do CAR
async function fetchProdesPolygonalByBbox(bboxParam) {
    try {
        // Descobrir UF do CAR carregado (assume pelo primeiro carCodes[])
        let uf = null;
        if (carCodes && carCodes.length > 0) {
            const code = carCodes[0];
            if (typeof code === 'string' && code.length >= 2) {
                uf = code.slice(0,2).toUpperCase();
            }
        }
        if (!uf) {
            console.warn('Não foi possível determinar a UF do CAR para consulta PRODES poligonal.');
            return null;
        }
        const jsonFile = `./${uf}_prodes.json`;
        const response = await fetch(jsonFile);
        if (!response.ok) {
            console.warn(jsonFile + ' não encontrado ou erro ao carregar:', response.status);
            return null;
        }
        const geojson = await response.json();
        // Filtra features que intersectam o bbox
        const bboxArr = bboxParam.replace(',EPSG:4326','').split(',').map(Number);
        const bboxPoly = turf.bboxPolygon(bboxArr);
        const intersecting = geojson.features.filter(f => {
            try {
                return turf.booleanIntersects(f, bboxPoly);
            } catch (e) { return false; }
        });
        if (intersecting.length > 0) {
            const intersectGeo = { type: 'FeatureCollection', features: intersecting };
            const layer = L.geoJSON(intersectGeo, {
                style: { color: '#ff00ff', weight: 2, fillOpacity: 0.5 },
                onEachFeature: (feat, layer) => {
                    layer.bindPopup(`<b>PRODES Poligonal (${uf}_prodes.json)</b>`);
                }
            });
            prodesLayers.push(layer);
            layer.addTo(map);
            return intersectGeo;
        }
        return null;
    } catch (err) {
        console.warn('Erro ao consultar PRODES poligonal por UF:', err);
        return null;
    }
}
// Garante que a função global triggerBackgroundEnvironmentalAnalysis exista
window.triggerBackgroundEnvironmentalAnalysis = function() {
	if (window.carCodeFeatures && window.carCodeFeatures.length > 0) {
		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		window.carCodeFeatures.forEach(feature => {
			try {
				const bbox = turf.bbox(feature);
				minX = Math.min(minX, bbox[0]);
				minY = Math.min(minY, bbox[1]);
				maxX = Math.max(maxX, bbox[2]);
				maxY = Math.max(maxY, bbox[3]);
			} catch (error) {
				console.error('Erro ao calcular BBOX do feature:', error, feature);
			}
		});
		if (isFinite(minX) && isFinite(minY) && isFinite(maxX) && isFinite(maxY)) {
			fetchEnvironmentalDataCombined([minX, minY, maxX, maxY]);
		}
	}
};

