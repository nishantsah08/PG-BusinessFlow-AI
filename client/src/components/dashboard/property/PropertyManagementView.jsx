import React, { useState, useEffect, useRef } from 'react';
import { Plus, Building, Search, Save, Loader2, Edit2, Trash2, X, Tag, ListFilter, MoreVertical, Wallet } from 'lucide-react';
import { apiClient } from '../../../api/client';

const PIN_DIRECTORY = {
    '411001': { area: 'Camp', city: 'Pune', state: 'Maharashtra' },
    '411015': { area: 'Kharadi', city: 'Pune', state: 'Maharashtra' },
    '411014': { area: 'Viman Nagar', city: 'Pune', state: 'Maharashtra' },
    '411045': { area: 'Baner', city: 'Pune', state: 'Maharashtra' },
    '411057': { area: 'Hinjewadi', city: 'Pune', state: 'Maharashtra' },
    '560001': { area: 'Ashok Nagar', city: 'Bengaluru', state: 'Karnataka' },
    '110001': { area: 'Connaught Place', city: 'New Delhi', state: 'Delhi' },
};

const LEGACY_CANONICAL_PAYMENT_CYCLE_RULE = '1st-5th: Standard Deposit; 6th-10th: Additional Deposit';
const CANONICAL_PAYMENT_CYCLE_RULE = '1st-5th of every month: Standard Deposit; 6th-10th of every month: Additional Deposit';
const LEGACY_DYNAMIC_PAYMENT_CYCLE_RULE = '1st-5th: Standard; 6th-10th: Standard + 5 Days Rent';
const PAYMENT_CYCLE_RULE_OPTIONS = [
    {
        value: CANONICAL_PAYMENT_CYCLE_RULE,
        label: 'Standard monthly 2-cycle rule'
    }
];

const PropertyManagementView = () => {
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [isEditing, setIsEditing] = useState(false);

    // Form States
    const [editName, setEditName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editPinCode, setEditPinCode] = useState('');
    const [editArea, setEditArea] = useState('');
    const [editCity, setEditCity] = useState('');
    const [editState, setEditState] = useState('');
    const [editGbl, setEditGbl] = useState('');
    const [editFloors, setEditFloors] = useState('');
    const [editImages, setEditImages] = useState([]);
    const [editThumbnailUrl, setEditThumbnailUrl] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [newImageUrl, setNewImageUrl] = useState('');
    const [editAmenities, setEditAmenities] = useState([]);
    const [newEditAmenity, setNewEditAmenity] = useState('');

    // Unit & Amenities States
    const [units, setUnits] = useState([]);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState(null);
    const [newUnitId, setNewUnitId] = useState('');
    const [newUnitTypes, setNewUnitTypes] = useState([]);
    const [newUnitTypeInput, setNewUnitTypeInput] = useState('');
    const [newUnitFloor, setNewUnitFloor] = useState('');
    const [newUnitBaseRent, setNewUnitBaseRent] = useState('');
    const [newUnitSecurityDeposit, setNewUnitSecurityDeposit] = useState('2500');
    const [newUnitRentPaymentTiming, setNewUnitRentPaymentTiming] = useState('ADVANCE');
    const [newUnitUtilityPaymentTiming, setNewUnitUtilityPaymentTiming] = useState('ARREARS');
    const [newUnitMaintenanceFee, setNewUnitMaintenanceFee] = useState('0');
    const [newUnitNoticePeriodDays, setNewUnitNoticePeriodDays] = useState('30');
    const [newUnitMinStayMonths, setNewUnitMinStayMonths] = useState('6');
    const [newUnitEarlyExitRule, setNewUnitEarlyExitRule] = useState('DEPOSIT_FORFEIT');
    const [newUnitPaymentCycleRules, setNewUnitPaymentCycleRules] = useState(CANONICAL_PAYMENT_CYCLE_RULE);
    const [newUnitAmenities, setNewUnitAmenities] = useState([]);
    const [customUnitTypes, setCustomUnitTypes] = useState(() => {
        try {
            const raw = localStorage.getItem('property_custom_unit_types');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    });

    const [amenities, setAmenities] = useState([]);
    const [newAmenity, setNewAmenity] = useState('');

    const PREDEFINED_UNIT_TYPES = ["1 BHK", "2 BHK", "Studio", "Single Sharing", "Double Sharing", "PG Bed"];
    const ALL_UNIT_TYPES = [...new Set([...PREDEFINED_UNIT_TYPES, ...customUnitTypes])];

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingObject, setIsSavingObject] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPropertyActionMenuOpen, setIsPropertyActionMenuOpen] = useState(false);
    const [openUnitMenuId, setOpenUnitMenuId] = useState(null);
    const [financeUnitId, setFinanceUnitId] = useState(null);
    const [financeSnapshot, setFinanceSnapshot] = useState(null);
    const [financeError, setFinanceError] = useState('');
    const [financeLoading, setFinanceLoading] = useState(false);
    const propertyActionMenuRef = useRef(null);
    const unitActionMenuRefs = useRef({});

    useEffect(() => {
        const handleCloseMenus = (event) => {
            if (propertyActionMenuRef.current && !propertyActionMenuRef.current.contains(event.target)) {
                setIsPropertyActionMenuOpen(false);
            }

            if (openUnitMenuId && unitActionMenuRefs.current[openUnitMenuId] && !unitActionMenuRefs.current[openUnitMenuId].contains(event.target)) {
                setOpenUnitMenuId(null);
            }
        };

        document.addEventListener('mousedown', handleCloseMenus);
        const handleEscapeMenu = (event) => {
            if (event.key === 'Escape') {
                setIsPropertyActionMenuOpen(false);
                setOpenUnitMenuId(null);
            }
        };

        document.addEventListener('keydown', handleEscapeMenu);
        return () => {
            document.removeEventListener('keydown', handleEscapeMenu);
            document.removeEventListener('mousedown', handleCloseMenus);
        };
    }, [openUnitMenuId]);

    const getTenantIdFromLocalUser = () => {
        try {
            const rawUser = localStorage.getItem('master_ai_user');
            if (!rawUser) return '';
            const user = JSON.parse(rawUser);
            const deriveTenantFromEmail = (value) => {
                if (typeof value !== 'string') return '';
                const normalizedEmail = value.trim().toLowerCase();
                if (!normalizedEmail.endsWith('@example.com')) return '';
                return normalizedEmail.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
            };

            const emailTenant = deriveTenantFromEmail(user?.email);
            if (emailTenant) return emailTenant;

            if (typeof user?.tenant_id === 'string' && user.tenant_id.trim()) {
                return String(user.tenant_id).trim();
            }
            if (typeof user?.tenantId === 'string' && user.tenantId.trim()) {
                return String(user.tenantId).trim();
            }
        } catch (_error) {
            // Local auth context is optional in mocked/test paths.
        }
        return '';
    };

    const getApiHeaders = (forJson = false) => {
        const headers = {};
        if (forJson) headers['Content-Type'] = 'application/json';
        const tenantId = getTenantIdFromLocalUser();
        if (tenantId) {
            headers['X-Tenant-ID'] = tenantId;
        }
        try {
            const rawUser = localStorage.getItem('master_ai_user');
            if (rawUser) {
                const user = JSON.parse(rawUser);
                if (user?.idToken) {
                    headers.Authorization = `Bearer ${user.idToken}`;
                }
                if (user?.email) {
                    headers['X-Actor-Email'] = String(user.email).toLowerCase();
                }
            }
        } catch (_error) {
            // Local auth context is optional in mocked/test paths.
        }
        return headers;
    };

    const parseToolResponse = async (response) => {
        const payload = await response.json();
        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'success')) {
            if (response.status !== 200 || payload.success === false) {
                throw new Error(payload.error || `Tool call failed with status ${response.status}`);
            }
            return payload;
        }
        if (!response.ok) {
            throw new Error(payload?.error || `Tool call failed with status ${response.status}`);
        }
        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
            return { success: true, data: payload.data };
        }
        return { success: true, data: payload };
    };

    const executeTool = async (tool, parameters = {}) => {
        const tenantId = getTenantIdFromLocalUser();
        const body = {
            agent_name: 'PropertyAI',
            tool_name: tool,
            parameters
        };
        if (tenantId) {
            body.tenant_id = tenantId;
        }
        const response = await apiClient.post('/api/master_ai/tools/execute', body);
        if (!response.success) {
            throw new Error(response.error || 'Tool call failed');
        }
        return { success: true, data: response.data };
    };

    const executeFinanceTool = async (tool, parameters = {}) => {
        const tenantId = getTenantIdFromLocalUser();
        const body = {
            agent_name: 'FinanceAI',
            tool_name: tool,
            parameters
        };
        if (tenantId) {
            body.tenant_id = tenantId;
        }
        const response = await apiClient.post('/api/master_ai/tools/execute', body);
        if (!response.success) {
            throw new Error(response.error || 'Tool call failed');
        }
        return { success: true, data: response.data };
    };

    const parseAddressParts = (property) => {
        const pin = property?.pin_code ? String(property.pin_code).trim() : '';
        const area = property?.area || '';
        const city = property?.city || '';
        const state = property?.state || '';
        if (pin || area || city || state || property?.street_address || (property?.address || '').trim()) {
            const parts = String(property?.address || '').split(',').map((s) => s.trim()).filter(Boolean);
            let inferredPin = pin;
            let inferredStreet = String(property?.street_address || '').trim();
            let inferredArea = area;
            let inferredCity = city;
            let inferredState = state;

            if (!inferredPin && parts.length > 0 && /^\d{5,6}$/.test(parts[parts.length - 1])) {
                inferredPin = parts.pop();
            }

            if (!inferredArea && !inferredCity && !inferredState && parts.length > 0 && !inferredStreet) {
                if (parts.length === 1) {
                    inferredStreet = parts[0];
                } else if (parts.length === 2) {
                    inferredStreet = parts[0];
                    inferredCity = parts[1];
                } else if (parts.length === 3) {
                    inferredStreet = parts[0];
                    inferredCity = parts[1];
                    inferredState = parts[2];
                } else if (parts.length > 3) {
                    inferredStreet = parts[0];
                    inferredArea = parts.slice(1, parts.length - 2).join(', ');
                    inferredCity = parts[parts.length - 2];
                    inferredState = parts[parts.length - 1];
                }
            }
            if (!inferredStreet && parts.length > 0) {
                inferredStreet = parts[0];
            }

            return {
                pin: inferredPin,
                area: inferredArea,
                city: inferredCity,
                state: inferredState,
                street: inferredStreet
            };
        }

        return { pin: '', area: '', city: '', state: '', street: '' };
    };

    const normalizeImageList = (value) => {
        if (Array.isArray(value)) {
            return value
                .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
                .filter(Boolean);
        }
        if (typeof value === 'string' && value.trim()) {
            return [value.trim()];
        }
        return [];
    };

    const buildRateCardTemplate = async () => {
        try {
            const payload = await executeTool('get_public_rate_card');
            const rateCard = payload?.data || {};
            return {
                baseRent: String(rateCard.monthly_rent ?? 12000),
                securityDeposit: String(rateCard.base_security_deposit ?? 2500),
                rentTiming: rateCard.rent_payment_timing || 'ADVANCE',
                utilityTiming: rateCard.utility_payment_timing || 'ARREARS',
                maintenanceFee: String(rateCard.maintenance_fee ?? 0),
                noticePeriodDays: String(rateCard.notice_period_days ?? 30),
                minStayMonths: String(rateCard.min_stay_months ?? 6),
                earlyExitRule: rateCard.early_exit_rule || 'DEPOSIT_FORFEIT',
                paymentCycleRules: normalizePaymentCycleRule(rateCard.payment_cycle_rules)
            };
        } catch (_error) {
            return {
                baseRent: '12000',
                securityDeposit: '2500',
                rentTiming: 'ADVANCE',
                utilityTiming: 'ARREARS',
                maintenanceFee: '0',
                noticePeriodDays: '30',
                minStayMonths: '6',
                earlyExitRule: 'DEPOSIT_FORFEIT',
                paymentCycleRules: CANONICAL_PAYMENT_CYCLE_RULE
            };
        }
    };

    const normalizePaymentCycleRule = (value) => {
        if (value === LEGACY_CANONICAL_PAYMENT_CYCLE_RULE) return CANONICAL_PAYMENT_CYCLE_RULE;
        if (value === LEGACY_DYNAMIC_PAYMENT_CYCLE_RULE) return CANONICAL_PAYMENT_CYCLE_RULE;
        if (typeof value === 'string' && value.trim()) return value.trim();
        return CANONICAL_PAYMENT_CYCLE_RULE;
    };

    const getPaymentCycleRuleOptions = (currentValue) => {
        const normalizedValue = normalizePaymentCycleRule(currentValue);
        const options = [...PAYMENT_CYCLE_RULE_OPTIONS];
        if (normalizedValue && !options.some((option) => option.value === normalizedValue)) {
            options.unshift({
                value: normalizedValue,
                label: 'Custom / Legacy Policy'
            });
        }
        return options;
    };

    const getImageSources = (property) => {
        if (!property) return [];
        const fromPayload = [
            ...normalizeImageList(property.image_urls),
            ...normalizeImageList(property.images),
            ...normalizeImageList(property.image_list),
            ...normalizeImageList(property.media_urls),
            ...normalizeImageList(property.media)
        ];
        const deduped = [...new Set(fromPayload)];
        if (deduped.length > 0) return deduped;

        const thumbnail = normalizeImageList(property.thumbnail_url)[0] || normalizeImageList(property.thumbnail)[0];
        if (thumbnail) return [thumbnail];
        return [];
    };

    const hydrateEditForm = (property) => {
        const parts = parseAddressParts(property);
        setSelectedProperty(property);
        setEditName(property?.name || '');
        setEditPinCode(parts.pin || '');
        setEditArea(parts.area || '');
        setEditCity(parts.city || '');
        setEditState(parts.state || '');
        setEditAddress(parts.street || property?.street_address || '');
        setEditDescription(property?.description || '');
        setEditGbl(property?.google_business_link || '');
        setEditFloors(property?.floors || '');
        const normalizedImages = getImageSources(property);
        setEditImages(normalizedImages);
        setEditThumbnailUrl(property?.thumbnail_url || normalizedImages[0] || '');
        setEditAmenities(property?.amenities || []);
    };

    const isPropertyEnabled = (property) => {
        return property?.is_enabled !== false;
    };

    const canDeleteProperty = (property) => property?.can_delete !== false;
    const canDeleteUnit = (unit) => unit?.can_delete !== false;

    const mergePropertyForEdit = (existingProperty, nextProperty) => {
        if (!nextProperty) return existingProperty;
        const hasImagePayload = ['image_urls', 'images', 'image_list', 'media_urls', 'media', 'thumbnail_url', 'thumbnail'].some((key) => Object.prototype.hasOwnProperty.call(nextProperty, key));
        const nextImages = getImageSources(nextProperty);
        const fallbackImages = getImageSources(existingProperty);
        const hasExplicitImageArrayPayload =
            ['image_urls', 'images', 'image_list', 'media_urls', 'media'].some((key) => Object.prototype.hasOwnProperty.call(nextProperty, key));
        const hasExplicitThumbnailPayload = Object.prototype.hasOwnProperty.call(nextProperty, 'thumbnail_url') || Object.prototype.hasOwnProperty.call(nextProperty, 'thumbnail');
        const hasExplicitEmptyImageArrays = ['image_urls', 'images', 'image_list', 'media_urls', 'media'].some((key) => {
            const value = nextProperty[key];
            return Array.isArray(value) && value.length === 0;
        });

        const merged = {
            ...existingProperty,
            ...nextProperty,
            image_urls: hasImagePayload
                ? (hasExplicitEmptyImageArrays && fallbackImages.length > 0 && !hasExplicitThumbnailPayload
                    ? fallbackImages
                    : nextImages)
                : fallbackImages
        };
        const nextThumbnail = normalizeImageList(nextProperty.thumbnail_url)[0] || normalizeImageList(nextProperty.thumbnail)[0];
        if (merged.image_urls.length === 0 && nextThumbnail) merged.image_urls = [nextThumbnail];
        if (merged.image_urls.length === 0 && fallbackImages.length > 0) {
            merged.image_urls = fallbackImages;
        }
        return merged;
    };

    const refreshAndHydrateEditForm = async (propertyId) => {
        if (!propertyId) return;

        let propertyForEdit = properties.find((p) => p.id === propertyId) || selectedProperty;

        try {
            const payload = await executeTool('get_properties', { property_id: propertyId });
            if (payload && payload.data && payload.data.id) {
                propertyForEdit = mergePropertyForEdit(propertyForEdit, payload.data);
            }
        } catch (e) {
            console.error('Failed to refresh property before edit:', e);
        }

        if (propertyForEdit) {
            hydrateEditForm(propertyForEdit);
            setIsEditing(true);
        }
    };

    const composeAddress = ({ street, area, city, state, pin }) => {
        return [street, area, city, state, pin].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
    };

    const applyPinDetails = (pin, forceAddressRefresh = false) => {
        const cleaned = String(pin || '').trim();
        const known = PIN_DIRECTORY[cleaned];
        if (!known) return;
        setEditArea(known.area);
        setEditCity(known.city);
        setEditState(known.state);
        const composed = composeAddress({ street: editAddress, area: editArea || known.area, city: editCity || known.city, state: editState || known.state, pin: cleaned });
        if (forceAddressRefresh || !editAddress || editAddress.trim().length === 0) setEditAddress(composed);
    };

    useEffect(() => {
        localStorage.setItem('property_custom_unit_types', JSON.stringify(customUnitTypes));
    }, [customUnitTypes]);

    useEffect(() => {
        if (String(editPinCode).length === 6) {
            applyPinDetails(editPinCode);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editPinCode]);

    const fetchProperties = async (selectId = null) => {
        try {
            const payload = await executeTool('get_properties', {});
            const data = payload.data;
            setProperties(data || []);

            if (data && data.length > 0) {
                if (selectId) {
                    const toSelect = data.find(p => p.id === selectId) || data[0];
                    handleSelect(toSelect);
                } else if (!selectedProperty || !data.find(p => p.id === selectedProperty.id)) {
                    handleSelect(data[0]);
                } else {
                    handleSelect(data.find(p => p.id === selectedProperty.id));
                }
            } else {
                setSelectedProperty(null);
                setUnits([]);
                setAmenities([]);
            }
        } catch (e) {
            console.error("Failed to fetch properties:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProperties();
    }, []);

    const fetchUnitsAndAmenities = async (propertyId) => {
        try {
            // Fetch Units
            const unitsData = await executeTool('get_units', { property_id: propertyId });
            // Sort by numerical floor first
            const sortedUnits = (unitsData.data || []).sort((a, b) => parseInt(a.floor) - parseInt(b.floor));
            setUnits(sortedUnits);

            // Fetch Amenities (From Property object)
            const prop = properties.find(p => p.id === propertyId);
            setAmenities(prop?.amenities || []);
        } catch (e) {
            console.error("Error fetching units/amenities", e);
        }
    };

    const handleSelect = (prop) => {
        hydrateEditForm(prop);
        setIsEditing(false);
        fetchUnitsAndAmenities(prop.id);
    };

    const handleAddClick = () => {
        setSelectedProperty(null);
        setEditName('');
        setEditPinCode('');
        setEditArea('');
        setEditCity('');
        setEditState('');
        setEditAddress('');
        setEditDescription('');
        setEditGbl('');
        setEditFloors('');
        setEditImages([]);
        setEditThumbnailUrl('');
        setEditAmenities([]);
        setUnits([]);
        setAmenities([]);
        setIsEditing(true);
    };

    const handleSavePrimary = async () => {
        setIsSavingObject(true);
        try {
            const normalizedPin = String(editPinCode || '').trim();
            const normalizedArea = String(editArea || '').trim();
            const normalizedCity = String(editCity || '').trim();
            const normalizedState = String(editState || '').trim();
            const normalizedStreet = String(editAddress || '').trim();
            const finalAddress = composeAddress({
                street: normalizedStreet,
                area: normalizedArea,
                city: normalizedCity,
                state: normalizedState,
                pin: normalizedPin
            });
            const thumbnailUrl = editThumbnailUrl && editImages.includes(editThumbnailUrl)
                ? editThumbnailUrl
                : (editImages[0] || '');
            const orderedImages = thumbnailUrl
                ? [thumbnailUrl, ...editImages.filter((img) => img !== thumbnailUrl)]
                : editImages;

            const payload = {
                name: editName,
                address: finalAddress,
                pin_code: normalizedPin || undefined,
                area: normalizedArea || undefined,
                city: normalizedCity || undefined,
                state: normalizedState || undefined,
                street_address: normalizedStreet || undefined,
                description: editDescription,
                google_business_link: editGbl,
                floors: editFloors ? parseInt(editFloors) : null,
                image_urls: orderedImages,
                thumbnail_url: thumbnailUrl || undefined,
                amenities: editAmenities
            };

            const tool = selectedProperty ? 'update_property' : 'add_property';
            if (selectedProperty) payload.property_id = selectedProperty.id;

            const response = await executeTool(tool, payload);
            const { data } = response;
            await fetchProperties(data?.property_id || selectedProperty?.id);
            setIsEditing(false);
        } catch (e) {
            console.error("Save error:", e);
            alert(e?.message || "Failed to save property.");
        } finally {
            setIsSavingObject(false);
        }
    };

    const handleDeleteProperty = async () => {
        if (!selectedProperty) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedProperty.name}?`)) return;

        setIsDeleting(true);
        try {
            await executeTool('delete_property', { property_id: selectedProperty.id });
            await fetchProperties();
        } catch (e) {
            console.error("Delete error", e);
            alert("Failed to delete property");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleTogglePropertyState = async () => {
        if (!selectedProperty) return;
        const tool = isPropertyEnabled(selectedProperty) ? 'disable_property' : 'enable_property';
        try {
            const response = await executeTool(tool, { property_id: selectedProperty.id });
            const isNowEnabled = tool === 'enable_property' || (response?.data?.disabled === false);
            setSelectedProperty((prev) => (prev ? { ...prev, is_enabled: isNowEnabled } : prev));
            await fetchProperties(selectedProperty.id);
        } catch (e) {
            console.error('Error toggling property state', e);
            alert(`Failed to ${isPropertyEnabled(selectedProperty) ? 'disable' : 'enable'} property`);
        }
    };

    const handleToggleUnitState = async (unit) => {
        const tool = unit?.is_enabled === false ? 'enable_unit' : 'disable_unit';
        try {
            await executeTool(tool, { unit_id: unit.id });
            await fetchUnitsAndAmenities(selectedProperty?.id);
        } catch (e) {
            console.error('Error toggling unit state', e);
            alert(`Failed to ${tool === 'disable_unit' ? 'disable' : 'enable'} unit`);
        }
    };

    const handleAddUnitClick = () => {
        if (!selectedProperty) return;
        if (!isPropertyEnabled(selectedProperty)) {
            alert('Enable the property first to add units.');
            return;
        }
        setEditingUnitId(null);
        setNewUnitId('');
        setNewUnitFloor('');
        setNewUnitTypes([]);
        setNewUnitTypeInput('');

        buildRateCardTemplate().then((rateTemplate) => {
            setNewUnitBaseRent(rateTemplate.baseRent);
            setNewUnitSecurityDeposit(rateTemplate.securityDeposit);
            setNewUnitRentPaymentTiming(rateTemplate.rentTiming);
            setNewUnitUtilityPaymentTiming(rateTemplate.utilityTiming);
            setNewUnitMaintenanceFee(rateTemplate.maintenanceFee);
            setNewUnitNoticePeriodDays(rateTemplate.noticePeriodDays);
            setNewUnitMinStayMonths(rateTemplate.minStayMonths);
            setNewUnitEarlyExitRule(rateTemplate.earlyExitRule);
            setNewUnitPaymentCycleRules(rateTemplate.paymentCycleRules);
        });

        // Default select all property amenities for a new unit
        setNewUnitAmenities(selectedProperty?.amenities || []);
        setIsUnitModalOpen(true);
    };

    const handleEditUnitClick = async (unit) => {
        if (!isPropertyEnabled(selectedProperty) || unit?.is_enabled === false) {
            alert('Enable property and unit first to edit this unit.');
            return;
        }
        const rate = unit.rate_card || {};
        const rateTemplate = await buildRateCardTemplate();
        setEditingUnitId(unit.id);
        setNewUnitId(unit.unit_number);
        setNewUnitFloor(unit.floor);
        setNewUnitBaseRent(unit.base_rent || '');
        setNewUnitSecurityDeposit(String(rate.security_deposit ?? rateTemplate.securityDeposit));
        setNewUnitRentPaymentTiming(rate.rent_payment_timing || rateTemplate.rentTiming);
        setNewUnitUtilityPaymentTiming(rate.utility_payment_timing || rateTemplate.utilityTiming);
        setNewUnitMaintenanceFee(String(rate.maintenance_fee ?? rateTemplate.maintenanceFee));
        setNewUnitNoticePeriodDays(String(rate.notice_period_days ?? rateTemplate.noticePeriodDays));
        setNewUnitMinStayMonths(String(rate.min_stay_months ?? rateTemplate.minStayMonths));
        setNewUnitEarlyExitRule(rate.early_exit_rule || rateTemplate.earlyExitRule);
        setNewUnitPaymentCycleRules(rate.payment_cycle_rules || rateTemplate.paymentCycleRules);
        setNewUnitTypes(unit.types || []);
        setNewUnitTypeInput('');
        setNewUnitAmenities(unit.amenities || []);
        setIsUnitModalOpen(true);
    };

    const handleSaveUnit = async (e) => {
        e.preventDefault();
        if (!newUnitId || !selectedProperty || newUnitFloor === '') return;

        setIsSavingObject(true);
        try {
            const endpoint = editingUnitId ? 'update_unit' : 'add_unit';
            const normalizedTypes = newUnitTypes.length > 0 ? newUnitTypes : ['Standard'];
            const propertyAmenitySet = new Set((selectedProperty?.amenities || []).map((amenity) => String(amenity || '').trim()).filter(Boolean));
            const sanitizedUnitAmenities = newUnitAmenities.filter((amenity) => propertyAmenitySet.has(String(amenity || '').trim()));
            const payload = {
                property_id: selectedProperty.id,
                unit_number: newUnitId.trim(),
                floor: parseInt(newUnitFloor),
                types: normalizedTypes,
                base_rent: newUnitBaseRent ? parseInt(newUnitBaseRent) : 0,
                rate_card: {
                    base_rent: newUnitBaseRent ? parseInt(newUnitBaseRent) : 0,
                    security_deposit: newUnitSecurityDeposit ? parseInt(newUnitSecurityDeposit) : 0,
                    rent_payment_timing: newUnitRentPaymentTiming,
                    utility_payment_timing: newUnitUtilityPaymentTiming,
                    maintenance_fee: newUnitMaintenanceFee ? parseInt(newUnitMaintenanceFee) : 0,
                    notice_period_days: newUnitNoticePeriodDays ? parseInt(newUnitNoticePeriodDays) : 30,
                    min_stay_months: newUnitMinStayMonths ? parseInt(newUnitMinStayMonths) : 6,
                    early_exit_rule: newUnitEarlyExitRule || 'DEPOSIT_FORFEIT',
                    payment_cycle_rules: newUnitPaymentCycleRules
                },
                amenities: sanitizedUnitAmenities
            };

            const customFromSelection = normalizedTypes
                .map((type) => String(type || '').trim())
                .filter((type) => type && !PREDEFINED_UNIT_TYPES.includes(type));
            if (customFromSelection.length > 0) {
                setCustomUnitTypes((prev) => [...new Set([...prev, ...customFromSelection])]);
            }

            if (editingUnitId) {
                payload.unit_id = editingUnitId;
            }

            await executeTool(endpoint, payload);
            setIsUnitModalOpen(false);
            fetchUnitsAndAmenities(selectedProperty.id);
        } catch (e) {
            console.error("Error saving unit", e);
            alert(`Could not ${editingUnitId ? 'update' : 'add'} unit: ` + (e?.message || 'Unknown error'));
        } finally {
            setIsSavingObject(false);
        }
    };

    const handleDeleteUnit = async (unitId) => {
        try {
            await executeTool('delete_unit', { unit_id: unitId });
            fetchUnitsAndAmenities(selectedProperty.id);
        } catch (e) {
            console.error("Error deleting unit", e);
        }
    };

    const handleAddAmenity = async (e) => {
        e.preventDefault();
        if (!newAmenity || !selectedProperty) return;

        const updatedAmenities = [...new Set([...amenities, newAmenity.trim()])];

        try {
            await executeTool('update_property', {
                property_id: selectedProperty.id,
                amenities: updatedAmenities
            });
            setNewAmenity('');
            fetchProperties(selectedProperty.id);
        } catch (e) {
            console.error("Error adding amenity", e);
        }
    };

    const handleRemoveAmenity = async (amenityToRemove) => {
        if (!selectedProperty) return;
        const updatedAmenities = amenities.filter(a => a !== amenityToRemove);

        try {
            await executeTool('update_property', {
                property_id: selectedProperty.id,
                amenities: updatedAmenities
            });
            fetchProperties(selectedProperty.id);
        } catch (e) {
            console.error("Error removing amenity", e);
        }
    };

    const handleOpenUnitFinance = async (unit) => {
        setFinanceUnitId(unit.id);
        setFinanceSnapshot(null);
        setFinanceError('');
        setFinanceLoading(true);
        try {
            const result = await executeFinanceTool('get_unit_collection_status', { unit_id: unit.id });
            setFinanceSnapshot(result?.data?.data || null);
        } catch (error) {
            setFinanceError(error.message || 'Failed to load unit finance context.');
        } finally {
            setFinanceLoading(false);
        }
    };

    const normalizedExistingPin = String(selectedProperty?.pin_code || '').trim();
    const existingImages = getImageSources(selectedProperty);
    const hasRequiredName = String(editName || '').trim().length > 0;
    const hasRequiredPin = selectedProperty
        ? String(editPinCode || '').trim().length > 0 || normalizedExistingPin.length > 0
        : String(editPinCode || '').trim().length > 0;
    const hasRequiredStreetAddress = String(editAddress || '').trim().length > 0;
    const hasRequiredArea = String(editArea || '').trim().length > 0;
    const hasRequiredCity = String(editCity || '').trim().length > 0;
    const hasRequiredState = String(editState || '').trim().length > 0;
    const hasRequiredDescription = String(editDescription || '').trim().length > 0;
    const hasRequiredFloors = String(editFloors || '').trim().length > 0;
    const hasRequiredAmenities = editAmenities.length > 0;
    const hasRequiredImage = selectedProperty
        ? editImages.length > 0 || existingImages.length > 0 || !!selectedProperty?.thumbnail_url
        : editImages.length > 0 || !!editThumbnailUrl;

    const canSaveProperty = hasRequiredName && hasRequiredPin && hasRequiredStreetAddress && hasRequiredArea && hasRequiredCity && hasRequiredState && hasRequiredDescription && hasRequiredFloors && hasRequiredAmenities && hasRequiredImage;

    const requiredDot = <span className="ml-1 inline-flex h-2 w-2 rounded-full bg-red-500 text-red-500" aria-label="required field" />;

    return (
        <div className="flex h-full gap-6">
            {/* Left Column: List */}
            <div className="w-1/3 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">Properties ({properties.length})</h2>
                    <button
                        onClick={handleAddClick}
                        className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>

                <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search properties..."
                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                    {isLoading ? (
                        <div className="text-center p-4 text-gray-500 text-sm flex justify-center items-center"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...</div>
                    ) : properties.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                        <div className="text-center p-4 text-gray-500 text-sm">No properties found.</div>
                    ) : properties.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.address.toLowerCase().includes(searchQuery.toLowerCase())).map(prop => (
                        <div
                            key={prop.id}
                            onClick={() => { if (!isEditing) handleSelect(prop) }}
                            className={`p-3 rounded-xl cursor-pointer border transition-all flex items-stretch gap-3 ${selectedProperty?.id === prop.id
                                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                } ${isEditing && !selectedProperty ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {/* Thumbnail */}
                            <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                {(() => {
                                    const images = getImageSources(prop);
                                    const preview = prop.thumbnail_url || images[0];
                                    return preview ? (
                                        <img src={preview} alt={prop.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Building className="w-6 h-6" />
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-semibold text-gray-900 truncate pr-2 text-sm">{prop.name}</h3>
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide ${isPropertyEnabled(prop) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {isPropertyEnabled(prop) ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </div>
                                        </div>
                                <div className="flex items-center text-xs text-gray-500 truncate">
                                    <Building className="w-3 h-3 mr-1 shrink-0 text-gray-400" />
                                    <span className="truncate">{prop.address || 'No address'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column: Details */}
            <div className="w-2/3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                {selectedProperty || isEditing ? (
                    isEditing ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-gray-200 bg-white shrink-0">
                                <h2 className="text-xl font-bold">{selectedProperty ? 'Edit Property' : 'New Property'}</h2>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                                <div className="bg-white p-6 rounded-xl border border-gray-200">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Property Name {requiredDot}</label>
                                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Emerald Heights" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">PIN Code {requiredDot}</label>
                                            <input
                                                value={editPinCode}
                                                onChange={e => setEditPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                onBlur={() => applyPinDetails(editPinCode)}
                                                placeholder="e.g. 411014"
                                                required
                                                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Area / Locality {requiredDot}</label>
                                            <input value={editArea} onChange={e => setEditArea(e.target.value)} placeholder="e.g. Viman Nagar" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">City {requiredDot}</label>
                                            <input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="e.g. Pune" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">State {requiredDot}</label>
                                            <input value={editState} onChange={e => setEditState(e.target.value)} placeholder="e.g. Maharashtra" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Street Address {requiredDot}</label>
                                            <div className="flex gap-2">
                                                <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Building, street, landmark..." className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        applyPinDetails(editPinCode, true);
                                                        if (!editAddress.trim()) {
                                                            setEditAddress(composeAddress({ area: editArea, city: editCity, state: editState, pin: editPinCode }));
                                                        }
                                                    }}
                                                    className="shrink-0 bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium"
                                                >
                                                    Auto Fill
                                                </button>
                                            </div>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Description {requiredDot}</label>
                                            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Describe the building..." className="w-full h-20 text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Total Floors {requiredDot}</label>
                                            <input type="number" value={editFloors} onChange={e => setEditFloors(e.target.value)} placeholder="e.g. 3" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Google Business Link</label>
                                            <input value={editGbl} onChange={e => setEditGbl(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                            <label className="text-xs font-semibold text-gray-500">Property Images (At least 1 required) {requiredDot}</label>
                                            <div className="flex items-center gap-4">
                                                <label className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-indigo-200">
                                                    <Plus className="w-4 h-4" /> Upload Files from Computer
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
                                                            if (files.length === 0) return;

                                                            try {
                                                                const formData = new FormData();
                                                                files.forEach(f => formData.append('images', f));

                                                                const uploadResponse = await apiClient.post('/api/upload/images', formData);
                                                                const { success, data, error } = uploadResponse;
                                                                if (success && data?.urls) {
                                                                    setEditImages(prev => {
                                                                        const merged = [...prev, ...data.urls];
                                                                        if (!editThumbnailUrl && merged.length > 0) setEditThumbnailUrl(merged[0]);
                                                                        return merged;
                                                                    });
                                                                } else {
                                                                    alert("Upload failed: " + (error || "Unknown error"));
                                                                }
                                                            } catch (err) {
                                                                console.error("Failed to upload images", err);
                                                                alert("Failed to upload images. Please try again.");
                                                            }

                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                            {editImages.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {editImages.map((img, idx) => (
                                                        <div key={idx} className="relative group rounded border border-gray-200 overflow-hidden w-20 h-20 shadow-sm bg-gray-50">
                                                            <img src={img} alt="Property" className="w-full h-full object-cover" onError={(e) => { e.target.src = 'https://via.placeholder.com/80?text=Error'; }} />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = editImages.filter((_, i) => i !== idx);
                                                                    setEditImages(next);
                                                                    if (editThumbnailUrl === img) {
                                                                        setEditThumbnailUrl(next[0] || '');
                                                                    }
                                                                }}
                                                                className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditThumbnailUrl(img)}
                                                                className={`absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded font-semibold ${editThumbnailUrl === img ? 'bg-indigo-600 text-white' : 'bg-white/90 text-gray-700'}`}
                                                            >
                                                                {editThumbnailUrl === img ? 'Thumbnail' : 'Set Thumb'}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                            <label className="text-xs font-semibold text-gray-500">Amenities {requiredDot}</label>
                                            <div className="flex gap-2">
                                                <input
                                                    value={newEditAmenity}
                                                    onChange={e => setNewEditAmenity(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if ((e.key === 'Tab' || e.key === 'Enter') && newEditAmenity.trim()) {
                                                            e.preventDefault();
                                                            setEditAmenities([...new Set([...editAmenities, newEditAmenity.trim()])]);
                                                            setNewEditAmenity('');
                                                        }
                                                    }}
                                                    placeholder="e.g. Gym, WiFi (Press Tab to add)"
                                                    className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:border-indigo-500"
                                                />
                                                <button type="button" onClick={() => { if (newEditAmenity.trim()) { setEditAmenities([...new Set([...editAmenities, newEditAmenity.trim()])]); setNewEditAmenity(''); } }} className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">Add Amenity</button>
                                            </div>
                                            {editAmenities.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {editAmenities.map(am => (
                                                        <div key={am} className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 text-sm px-2.5 py-1 rounded-md">
                                                            {am}
                                                            <button type="button" onClick={() => setEditAmenities(editAmenities.filter(a => a !== am))} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="col-span-2 mt-6 pt-4 border-t border-gray-100 flex justify-end gap-2">
                                            <button onClick={() => selectedProperty ? setIsEditing(false) : fetchProperties()} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">Cancel</button>
                                            <button onClick={handleSavePrimary} disabled={isSavingObject || !canSaveProperty} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                                {isSavingObject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Property
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Read Only Header */}
                            <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-start shrink-0">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-200 bg-indigo-50 text-indigo-600 shrink-0">
                                        {(() => {
                                            const previewImages = getImageSources(selectedProperty);
                                            const preview = selectedProperty.thumbnail_url || previewImages[0];
                                            return preview ? (
                                                <img src={preview} alt={selectedProperty.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Building className="w-7 h-7" />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <div className="flex-1 mr-4">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedProperty.name}</h2>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPropertyEnabled(selectedProperty) ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {isPropertyEnabled(selectedProperty) ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <p className="text-gray-500 text-sm mb-2">{selectedProperty.address}</p>
                                        <div className="flex items-center gap-4 text-xs font-medium text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 inline-flex">
                                            <span>Floors: {selectedProperty.floors || 'N/A'}</span>
                                            {(getImageSources(selectedProperty).length > 0) && <span>Images: {getImageSources(selectedProperty).length}</span>}
                                        </div>
                                        {selectedProperty.google_business_link && (
                                            <div className="mt-2">
                                                <a href={selectedProperty.google_business_link} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline inline-flex items-center gap-1">
                                                    View on Google Maps
                                                </a>
                                            </div>
                                        )}
                                        {selectedProperty.description && <p className="text-sm text-gray-600 mt-3 italic">"{selectedProperty.description}"</p>}
                                    </div>
                                </div>
                                <div className="relative shrink-0" ref={propertyActionMenuRef}>
                                    <button
                                        onClick={() => {
                                            setOpenUnitMenuId(null);
                                            setIsPropertyActionMenuOpen((prev) => !prev);
                                        }}
                                        aria-label="Open property actions"
                                        aria-expanded={isPropertyActionMenuOpen}
                                        className="text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg p-2 transition-colors"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>
                                    {isPropertyActionMenuOpen && (
                                        <div role="menu" className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                                            <button
                                                onClick={() => {
                                                    setIsPropertyActionMenuOpen(false);
                                                    handleTogglePropertyState();
                                                }}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                                            >
                                                {isPropertyEnabled(selectedProperty) ? 'Disable Property' : 'Enable Property'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsPropertyActionMenuOpen(false);
                                                    if (selectedProperty) refreshAndHydrateEditForm(selectedProperty.id);
                                                    else setIsEditing(true);
                                                }}
                                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                                            >
                                                <span className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> Edit Details</span>
                                            </button>
                                            {canDeleteProperty(selectedProperty) ? (
                                                <button
                                                    onClick={() => {
                                                        setIsPropertyActionMenuOpen(false);
                                                        handleDeleteProperty();
                                                    }}
                                                    disabled={isDeleting}
                                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                                >
                                                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                                    <span>Delete Property</span>
                                                </button>
                                            ) : (
                                                <div className="w-full text-xs text-gray-500 px-3 py-2 border-t border-gray-100 bg-gray-50">
                                                    Delete unavailable for active units/transactions.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Units display */}
                            <div className="p-6 flex-1 overflow-y-auto bg-gray-50/50">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Units List */}
                                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                <ListFilter className="w-5 h-5 text-gray-500" />
                                                <h3 className="font-semibold text-gray-900">Registered Units ({units.length})</h3>
                                            </div>
                                            <button
                                                onClick={handleAddUnitClick}
                                                disabled={!isPropertyEnabled(selectedProperty)}
                                                className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Plus className="w-4 h-4" /> Add Unit
                                            </button>
                                        </div>

                                        <div className="max-h-96 overflow-y-auto pr-2 space-y-2 mb-4">
                                            {units.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">No units registered. Add one above.</p>
                                            ) : units.map(u => (
                                                <div key={u.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-indigo-50/30 group transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold text-gray-900">Unit {u.unit_number}</span>
                                                            <span className="text-xs text-gray-500">Floor {u.floor}</span>
                                                            {u.base_rent > 0 && <span className="text-xs text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded">₹{u.base_rent}/mo</span>}
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${u.is_enabled === false ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                {u.is_enabled === false ? 'Disabled' : 'Enabled'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {u.types && u.types.map(t => <span key={t} className="text-[10px] text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">{t}</span>)}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${u.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{u.status}</span>
                                                        <div className="relative" ref={(el) => { unitActionMenuRefs.current[u.id] = el; }}>
                                                            <button
                                                                aria-label={`Open actions for Unit ${u.unit_number}`}
                                                            onClick={() => setOpenUnitMenuId((prev) => prev === u.id ? null : u.id)}
                                                                className="text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded p-1 transition-colors"
                                                                aria-expanded={openUnitMenuId === u.id}
                                                            >
                                                                <MoreVertical className="w-4 h-4" />
                                                            </button>
                                                            {openUnitMenuId === u.id && (
                                                                <div role="menu" className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                                                                    <label className="w-full flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 text-sm text-gray-700">
                                                                        <span>Unit Active</span>
                                                                        <span className="relative inline-flex items-center">
                                                                            <input
                                                                                type="checkbox"
                                                                                aria-label={u.is_enabled === false ? `Enable Unit ${u.unit_number}` : `Disable Unit ${u.unit_number}`}
                                                                                checked={u.is_enabled !== false}
                                                                                onChange={() => {
                                                                                    setOpenUnitMenuId(null);
                                                                                    handleToggleUnitState(u);
                                                                                }}
                                                                                className="sr-only peer"
                                                                            />
                                                                            <span className={`w-9 h-5 bg-gray-300 rounded-full transition-colors peer-checked:bg-indigo-600 ${u.is_enabled === false ? 'bg-gray-300' : ''}`} />
                                                                            <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full border border-gray-300 transition-transform ${u.is_enabled === false ? 'translate-x-0' : 'translate-x-4'}`} />
                                                                        </span>
                                                                    </label>
                                                                    <button
                                                                        aria-label={`Edit Unit ${u.unit_number}`}
                                                                        onClick={() => {
                                                                            setOpenUnitMenuId(null);
                                                                            handleEditUnitClick(u);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100 disabled:opacity-50"
                                                                        disabled={u.is_enabled === false || !isPropertyEnabled(selectedProperty)}
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                        Edit Unit
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setOpenUnitMenuId(null);
                                                                            handleOpenUnitFinance(u);
                                                                        }}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b border-gray-100"
                                                                    >
                                                                        <Wallet className="w-3.5 h-3.5" />
                                                                        Current-Month Finance
                                                                    </button>
                                                                    {canDeleteUnit(u) ? (
                                                                        <button
                                                                            aria-label={`Delete Unit ${u.unit_number}`}
                                                                            onClick={() => {
                                                                                setOpenUnitMenuId(null);
                                                                                handleDeleteUnit(u.id);
                                                                            }}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                                                            disabled={u.is_enabled === false || !isPropertyEnabled(selectedProperty)}
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                            Delete Unit
                                                                        </button>
                                                                    ) : (
                                                                        <div className="w-full text-xs text-gray-500 px-3 py-2 border-t border-gray-100 bg-gray-50">
                                                                            Delete unavailable due to prior activity.
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                        <Building className="w-16 h-16 mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-500">No Property Selected</h3>
                        <p className="text-sm mt-1">Select a property from the sidebar or click 'Add' to create one</p>
                    </div>
                )}
            </div>

            {/* Unit Modal */}
            {isUnitModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 pb-6 pt-24">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[calc(100dvh-6.5rem)]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">{editingUnitId ? 'Edit Unit' : 'Add New Unit'}</h3>
                            <button onClick={() => setIsUnitModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            <form id="unit-form" onSubmit={handleSaveUnit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Number <span className="text-red-500">*</span></label>
                                        <input
                                            type="text" required value={newUnitId} onChange={e => setNewUnitId(e.target.value)}
                                            placeholder="e.g. 101"
                                            aria-label="Unit Number"
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Floor <span className="text-red-500">*</span></label>
                                        <input
                                            type="number" required value={newUnitFloor} onChange={e => setNewUnitFloor(e.target.value)}
                                            placeholder="e.g. 1"
                                            aria-label="Floor"
                                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Base Rent / Rate Card</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
                                            <input
                                                type="number" value={newUnitBaseRent} onChange={e => setNewUnitBaseRent(e.target.value)}
                                                placeholder="Monthly Rent"
                                                className="w-full text-sm pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Unit Types</label>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {ALL_UNIT_TYPES.map(type => (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => !newUnitTypes.includes(type) && setNewUnitTypes([...newUnitTypes, type])}
                                                    className={`text-xs px-2 py-1 rounded border transition-colors ${newUnitTypes.includes(type) ? 'bg-indigo-50 border-indigo-200 text-indigo-700 opacity-50 cursor-not-allowed' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'}`}
                                                    disabled={newUnitTypes.includes(type)}
                                                >
                                                    + {type}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={newUnitTypeInput}
                                                onChange={e => setNewUnitTypeInput(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if ((e.key === 'Tab' || e.key === 'Enter') && newUnitTypeInput.trim()) {
                                                        e.preventDefault();
                                                        const custom = newUnitTypeInput.trim();
                                                        setNewUnitTypes([...new Set([...newUnitTypes, custom])]);
                                                        if (!PREDEFINED_UNIT_TYPES.includes(custom)) {
                                                            setCustomUnitTypes((prev) => [...new Set([...prev, custom])]);
                                                        }
                                                        setNewUnitTypeInput('');
                                                    }
                                                }}
                                                placeholder="Custom Type + Press Tab"
                                                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (newUnitTypeInput.trim()) {
                                                        const custom = newUnitTypeInput.trim();
                                                        setNewUnitTypes([...new Set([...newUnitTypes, custom])]);
                                                        if (!PREDEFINED_UNIT_TYPES.includes(custom)) {
                                                            setCustomUnitTypes((prev) => [...new Set([...prev, custom])]);
                                                        }
                                                        setNewUnitTypeInput('');
                                                    }
                                                }}
                                                className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                            >Add</button>
                                        </div>
                                        {newUnitTypes.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                                                {newUnitTypes.map(t => (
                                                    <span key={t} className="flex items-center gap-1 text-[11px] bg-white text-gray-700 px-2 py-1 rounded border border-gray-200 shadow-sm">
                                                        {t} <button type="button" onClick={() => setNewUnitTypes(newUnitTypes.filter(x => x !== t))} className="text-gray-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Rate Card Details</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Security Deposit</label>
                                                <input type="number" value={newUnitSecurityDeposit} onChange={(e) => setNewUnitSecurityDeposit(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Maintenance Fee</label>
                                                <input type="number" value={newUnitMaintenanceFee} onChange={(e) => setNewUnitMaintenanceFee(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Rent Payment Timing</label>
                                                <select value={newUnitRentPaymentTiming} onChange={(e) => setNewUnitRentPaymentTiming(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                                                    <option value="ADVANCE">Advance</option>
                                                    <option value="ARREARS">Arrears</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Utility Payment Timing</label>
                                                <select value={newUnitUtilityPaymentTiming} onChange={(e) => setNewUnitUtilityPaymentTiming(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                                                    <option value="ARREARS">Arrears</option>
                                                    <option value="ADVANCE">Advance</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label htmlFor="unit-payment-cycle-rules" className="text-xs font-medium text-gray-500">Monthly Payment Cycle</label>
                                                <select
                                                    id="unit-payment-cycle-rules"
                                                    value={newUnitPaymentCycleRules}
                                                    onChange={(e) => setNewUnitPaymentCycleRules(e.target.value)}
                                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                                >
                                                    {getPaymentCycleRuleOptions(newUnitPaymentCycleRules).map((option) => (
                                                        <option key={option.value} value={option.value}>{option.label}</option>
                                                    ))}
                                                </select>
                                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                                                    <p>1st-5th of every month: Standard Deposit</p>
                                                    <p>6th-10th of every month: Additional Deposit</p>
                                                </div>
                                                <p className="text-[11px] text-gray-500">
                                                    Billing is generated on the last day of every month. Customers can pay in either monthly cycle shown above.
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Notice Period (Days)</label>
                                                <input type="number" value={newUnitNoticePeriodDays} onChange={(e) => setNewUnitNoticePeriodDays(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-medium text-gray-500">Min Stay (Months)</label>
                                                <input type="number" value={newUnitMinStayMonths} onChange={(e) => setNewUnitMinStayMonths(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                            </div>
                                            <div className="space-y-1 col-span-2">
                                                <label className="text-xs font-medium text-gray-500">Early Exit Rule</label>
                                                <select value={newUnitEarlyExitRule} onChange={(e) => setNewUnitEarlyExitRule(e.target.value)} className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
                                                    <option value="DEPOSIT_FORFEIT">Deposit Forfeit</option>
                                                    <option value="DEPOSIT_RETURN">Deposit Return on Exit</option>
                                                    <option value="NO_PENALTY">No Penalty</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                        <div className="flex justify-between items-center">
                                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Amenities <span className="text-gray-400 font-normal normal-case">(Inherited by default)</span></label>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            {selectedProperty?.amenities?.map(am => (
                                                <div key={am} className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`modal-am-${am}`}
                                                        checked={newUnitAmenities.includes(am)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setNewUnitAmenities([...newUnitAmenities, am]);
                                                            else setNewUnitAmenities(newUnitAmenities.filter(a => a !== am));
                                                        }}
                                                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                                    />
                                                    <label htmlFor={`modal-am-${am}`} className="text-sm text-gray-700">{am}</label>
                                                </div>
                                            ))}
                                            {(!selectedProperty?.amenities || selectedProperty.amenities.length === 0) && (
                                                <p className="text-sm text-gray-400 italic">No property amenities found.</p>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            </form>
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsUnitModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                Cancel
                            </button>
                            <button form="unit-form" type="submit" disabled={isSavingObject || !newUnitId || newUnitFloor === '' || newUnitTypes.length === 0} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                {isSavingObject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {editingUnitId ? 'Save Changes' : 'Add Unit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {financeUnitId && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 pb-6 pt-24">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100dvh-6.5rem)]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Current-Month Unit Finance</h3>
                                <p className="text-sm text-gray-500">This view reuses Property context and loads the finance breakup for the selected unit.</p>
                            </div>
                            <button aria-label="Close Unit Finance Modal" onClick={() => setFinanceUnitId(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {financeLoading ? (
                                <div className="flex items-center gap-3 text-sm text-gray-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading current-month finance...
                                </div>
                            ) : financeError ? (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{financeError}</div>
                            ) : financeSnapshot ? (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unit</div>
                                        <div className="mt-2 text-2xl font-semibold text-slate-900">Unit {financeSnapshot.unit_number}</div>
                                        <div className="mt-1 text-sm text-slate-600">Current month: {financeSnapshot.month_year}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-xl border border-slate-200 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Rent due</div>
                                            <div className="mt-2 text-xl font-semibold text-slate-900">INR {Number(financeSnapshot.rent_due || 0).toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Deposit due</div>
                                            <div className="mt-2 text-xl font-semibold text-slate-900">INR {Number(financeSnapshot.deposit_due || 0).toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Received</div>
                                            <div className="mt-2 text-xl font-semibold text-slate-900">INR {Number(financeSnapshot.received || 0).toLocaleString('en-IN')}</div>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 px-4 py-4">
                                            <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Pending</div>
                                            <div className="mt-2 text-xl font-semibold text-slate-900">INR {Number(financeSnapshot.pending || 0).toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Payment status</div>
                                        <div className="mt-2 text-lg font-semibold text-slate-900">{financeSnapshot.payment_status}</div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 px-4 py-4">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current-month breakup</div>
                                        <div className="mt-4 space-y-3">
                                            {(financeSnapshot.breakup || []).map((entry) => (
                                                <div key={entry.ledger_entry_id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm">
                                                    <div>
                                                        <div className="font-semibold text-slate-900">{entry.category}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{entry.status}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-slate-900">Due INR {Number(entry.amount_due || 0).toLocaleString('en-IN')}</div>
                                                        <div className="mt-1 text-xs text-slate-500">Paid INR {Number(entry.amount_paid || 0).toLocaleString('en-IN')} · Pending INR {Number(entry.balance || 0).toLocaleString('en-IN')}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {(financeSnapshot.breakup || []).length === 0 && (
                                                <div className="text-sm text-slate-500">No current-month ledger entries are attached to this unit yet.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500">No current-month finance context was found for this unit.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PropertyManagementView;
