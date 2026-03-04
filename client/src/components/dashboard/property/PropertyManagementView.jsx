import React, { useState, useEffect } from 'react';
import { Plus, Building, Search, Save, Loader2, Edit2, Trash2, X, Tag, ListFilter } from 'lucide-react';

const PIN_DIRECTORY = {
    '411001': { area: 'Camp', city: 'Pune', state: 'Maharashtra' },
    '411015': { area: 'Kharadi', city: 'Pune', state: 'Maharashtra' },
    '411014': { area: 'Viman Nagar', city: 'Pune', state: 'Maharashtra' },
    '411045': { area: 'Baner', city: 'Pune', state: 'Maharashtra' },
    '411057': { area: 'Hinjewadi', city: 'Pune', state: 'Maharashtra' },
    '560001': { area: 'Ashok Nagar', city: 'Bengaluru', state: 'Karnataka' },
    '110001': { area: 'Connaught Place', city: 'New Delhi', state: 'Delhi' },
};

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

    const parseAddressParts = (property) => {
        const pin = property?.pin_code ? String(property.pin_code) : '';
        const area = property?.area || '';
        const city = property?.city || '';
        const state = property?.state || '';
        if (pin || area || city || state || property?.street_address) {
            return {
                pin,
                area,
                city,
                state,
                street: property?.street_address || ''
            };
        }

        const segments = String(property?.address || '').split(',').map((s) => s.trim()).filter(Boolean);
        let guessedStreet = '';
        let guessedArea = '';
        let guessedCity = '';
        let guessedState = '';

        if (segments.length === 1) {
            guessedStreet = segments[0];
        } else if (segments.length === 2) {
            guessedStreet = segments[0];
            guessedCity = segments[1];
        } else if (segments.length === 3) {
            guessedStreet = segments[0];
            guessedCity = segments[1];
            guessedState = segments[2];
        } else if (segments.length > 3) {
            guessedStreet = segments[0];
            guessedArea = segments.slice(1, segments.length - 2).join(', ');
            guessedCity = segments[segments.length - 2];
            guessedState = segments[segments.length - 1];
        }

        return { pin: '', area: guessedArea, city: guessedCity, state: guessedState, street: guessedStreet };
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
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'get_properties',
                    parameters: {}
                })
            });
            const { data } = await res.json();
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
            const resUnits = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'get_units',
                    parameters: { property_id: propertyId }
                })
            });
            const unitsData = await resUnits.json();
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
        const parts = parseAddressParts(prop);
        setSelectedProperty(prop);
        setEditName(prop.name || '');
        setEditPinCode(parts.pin || '');
        setEditArea(parts.area || '');
        setEditCity(parts.city || '');
        setEditState(parts.state || '');
        setEditAddress(parts.street || prop.street_address || '');
        setEditDescription(prop.description || '');
        setEditGbl(prop.google_business_link || '');
        setEditFloors(prop.floors || '');
        setEditImages(prop.image_urls || []);
        setEditThumbnailUrl(prop.thumbnail_url || prop.image_urls?.[0] || '');
        setEditAmenities(prop.amenities || []);
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

            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: tool,
                    parameters: payload
                })
            });
            const { data, success, error } = await res.json();

            if (success) {
                await fetchProperties(data?.property_id || selectedProperty?.id);
                setIsEditing(false);
            } else {
                alert("Error saving: " + error);
            }
        } catch (e) {
            console.error("Save error:", e);
            alert("Network error while saving.");
        } finally {
            setIsSavingObject(false);
        }
    };

    const handleDeleteProperty = async () => {
        if (!selectedProperty) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedProperty.name}?`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'delete_property',
                    parameters: { property_id: selectedProperty.id }
                })
            });
            if (res.ok) {
                await fetchProperties();
            } else {
                alert("Failed to delete property");
            }
        } catch (e) {
            console.error("Delete error", e);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleAddUnitClick = () => {
        setEditingUnitId(null);
        setNewUnitId('');
        setNewUnitFloor('');
        setNewUnitBaseRent('12000');
        setNewUnitSecurityDeposit('2500');
        setNewUnitRentPaymentTiming('ADVANCE');
        setNewUnitUtilityPaymentTiming('ARREARS');
        setNewUnitMaintenanceFee('0');
        setNewUnitTypes([]);
        setNewUnitTypeInput('');

        // Default select all property amenities for a new unit
        setNewUnitAmenities(selectedProperty?.amenities || []);
        setIsUnitModalOpen(true);
    };

    const handleEditUnitClick = (unit) => {
        const rate = unit.rate_card || {};
        setEditingUnitId(unit.id);
        setNewUnitId(unit.unit_number);
        setNewUnitFloor(unit.floor);
        setNewUnitBaseRent(unit.base_rent || '');
        setNewUnitSecurityDeposit(String(rate.security_deposit ?? '2500'));
        setNewUnitRentPaymentTiming(rate.rent_payment_timing || 'ADVANCE');
        setNewUnitUtilityPaymentTiming(rate.utility_payment_timing || 'ARREARS');
        setNewUnitMaintenanceFee(String(rate.maintenance_fee ?? '0'));
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
                },
                amenities: newUnitAmenities
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

            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: endpoint, // add_unit or update_unit
                    parameters: payload
                })
            });
            if (res.ok) {
                setIsUnitModalOpen(false);
                fetchUnitsAndAmenities(selectedProperty.id);
            } else {
                const { error } = await res.json();
                alert(`Could not ${editingUnitId ? 'update' : 'add'} unit: ` + error);
            }
        } catch (e) {
            console.error("Error saving unit", e);
        } finally {
            setIsSavingObject(false);
        }
    };

    const handleDeleteUnit = async (unitId) => {
        try {
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'delete_unit',
                    parameters: { unit_id: unitId }
                })
            });
            if (res.ok) fetchUnitsAndAmenities(selectedProperty.id);
        } catch (e) {
            console.error("Error deleting unit", e);
        }
    };

    const handleAddAmenity = async (e) => {
        e.preventDefault();
        if (!newAmenity || !selectedProperty) return;

        const updatedAmenities = [...new Set([...amenities, newAmenity.trim()])];

        try {
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'update_property',
                    parameters: {
                        property_id: selectedProperty.id,
                        amenities: updatedAmenities
                    }
                })
            });

            if (res.ok) {
                setNewAmenity('');
                fetchProperties(selectedProperty.id);
            }
        } catch (e) {
            console.error("Error adding amenity", e);
        }
    };

    const handleRemoveAmenity = async (amenityToRemove) => {
        if (!selectedProperty) return;
        const updatedAmenities = amenities.filter(a => a !== amenityToRemove);

        try {
            const res = await fetch('/api/master_ai/tools/execute', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'PropertyAI',
                    tool_name: 'update_property',
                    parameters: {
                        property_id: selectedProperty.id,
                        amenities: updatedAmenities
                    }
                })
            });
            if (res.ok) {
                fetchProperties(selectedProperty.id);
            }
        } catch (e) {
            console.error("Error removing amenity", e);
        }
    };


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
                                {(prop.thumbnail_url || (prop.image_urls && prop.image_urls.length > 0)) ? (
                                    <img src={prop.thumbnail_url || prop.image_urls[0]} alt={prop.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <Building className="w-6 h-6" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-semibold text-gray-900 truncate pr-2 text-sm">{prop.name}</h3>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded shrink-0 uppercase tracking-wide">
                                        {prop.status}
                                    </span>
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
                                            <label className="text-xs font-semibold text-gray-500">Property Name</label>
                                            <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Emerald Heights" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">PIN Code</label>
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
                                            <label className="text-xs font-semibold text-gray-500">Area / Locality</label>
                                            <input value={editArea} onChange={e => setEditArea(e.target.value)} placeholder="e.g. Viman Nagar" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">City</label>
                                            <input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="e.g. Pune" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">State</label>
                                            <input value={editState} onChange={e => setEditState(e.target.value)} placeholder="e.g. Maharashtra" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Street Address</label>
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
                                            <label className="text-xs font-semibold text-gray-500">Description</label>
                                            <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} placeholder="Describe the building..." className="w-full h-20 text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Total Floors</label>
                                            <input type="number" value={editFloors} onChange={e => setEditFloors(e.target.value)} placeholder="e.g. 3" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs font-semibold text-gray-500">Google Business Link</label>
                                            <input value={editGbl} onChange={e => setEditGbl(e.target.value)} placeholder="https://maps.app.goo.gl/..." className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                        </div>
                                        <div className="col-span-2 space-y-2 pt-2 border-t border-gray-100">
                                            <label className="text-xs font-semibold text-gray-500">Property Images (At least 1 required)</label>
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

                                                                const res = await fetch('/api/upload/images', {
                                                                    method: 'POST',
                                                                    body: formData
                                                                });
                                                                const { success, data, error } = await res.json();
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
                                            <label className="text-xs font-semibold text-gray-500">Amenities</label>
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
                                            <button onClick={handleSavePrimary} disabled={isSavingObject || !editName || !editPinCode || editImages.length === 0} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
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
                                        {(selectedProperty.thumbnail_url || selectedProperty.image_urls?.[0]) ? (
                                            <img src={selectedProperty.thumbnail_url || selectedProperty.image_urls?.[0]} alt={selectedProperty.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Building className="w-7 h-7" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 mr-4">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedProperty.name}</h2>
                                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{selectedProperty.id}</span>
                                        </div>
                                        <p className="text-gray-500 text-sm mb-2">{selectedProperty.address}</p>
                                        <div className="flex items-center gap-4 text-xs font-medium text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 inline-flex">
                                            <span>Floors: {selectedProperty.floors || 'N/A'}</span>
                                            {selectedProperty.image_urls?.length > 0 && <span>Images: {selectedProperty.image_urls.length}</span>}
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
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button onClick={() => setIsEditing(true)} className="flex items-center justify-center gap-1 bg-gray-100 text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                        <Edit2 className="w-4 h-4" /> Edit Details
                                    </button>
                                    <button onClick={handleDeleteProperty} disabled={isDeleting} className="flex items-center justify-center gap-1 text-red-600 hover:bg-red-50 hover:border-red-100 border border-transparent px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Property
                                    </button>
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
                                                className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
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
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {u.types && u.types.map(t => <span key={t} className="text-[10px] text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">{t}</span>)}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${u.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{u.status}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleEditUnitClick(u)} className="text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button onClick={() => handleDeleteUnit(u.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
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
        </div>
    );
};

export default PropertyManagementView;
