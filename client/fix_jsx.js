const fs = require('fs');
const file = 'src/components/dashboard/property/PropertyManagementView.jsx';
const lines = fs.readFileSync(file, 'utf-8').split('\n');
const topLines = lines.slice(0, 304);

const replacement = `            {/* Right Column: Details */}
            <div className="w-2/3 bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
                {selectedProperty || isEditing ? (
                    isEditing ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-gray-200 bg-white shrink-0">
                                <h2 className="text-xl font-bold">{selectedProperty ? 'Edit Property' : 'New Property'}</h2>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 bg-white">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-500">Property Name</label>
                                        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Emerald Heights" className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs font-semibold text-gray-500">Full Address</label>
                                        <input value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Full street address..." className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
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
                                                    onChange={(e) => {
                                                        const files = Array.from(e.target.files);
                                                        if (files.length === 0) return;
                                                        const newImageUrls = files.map(file => URL.createObjectURL(file));
                                                        setEditImages(prev => [...prev, ...newImageUrls]);
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
                                                        <button type="button" onClick={() => setEditImages(editImages.filter((_, i) => i !== idx))} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
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
                                    <div className="col-span-2 mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                                        <button onClick={() => selectedProperty ? setIsEditing(false) : fetchProperties()} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors">Cancel</button>
                                        <button onClick={handleSavePrimary} disabled={isSavingObject || !editName || editImages.length === 0} className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                            {isSavingObject ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Property
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Read Only Header */}
                            <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-start shrink-0">
                                <div className="flex items-start gap-4 flex-1">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                                        <Building className="w-8 h-8" />
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
                                        </div>

                                        <div className="max-h-64 overflow-y-auto pr-2 space-y-2 mb-4">
                                            {units.length === 0 ? (
                                                <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">No units registered. Add one below.</p>
                                            ) : units.map(u => (
                                                <div key={u.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-indigo-50/30 group transition-colors">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-sm font-bold text-gray-900">Unit {u.unit_number}</span>
                                                            <span className="text-xs text-gray-500">Floor {u.floor}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {u.types && u.types.map(t => <span key={t} className="text-[10px] text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200">{t}</span>)}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${u.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{u.status}</span>
                                                        <button onClick={() => handleDeleteUnit(u.id)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <form onSubmit={handleAddUnit} className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <input
                                                    type="text" required value={newUnitId} onChange={e => setNewUnitId(e.target.value)}
                                                    placeholder="Unit # (e.g. 101)"
                                                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                                />
                                                <input
                                                    type="number" required value={newUnitFloor} onChange={e => setNewUnitFloor(e.target.value)}
                                                    placeholder="Floor (e.g. 1)"
                                                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                                />
                                                <div className="col-span-2 space-y-2">
                                                    <input
                                                        type="text"
                                                        value={newUnitTypeInput}
                                                        onChange={e => setNewUnitTypeInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if ((e.key === 'Tab' || e.key === 'Enter') && newUnitTypeInput.trim()) {
                                                                e.preventDefault();
                                                                setNewUnitTypes([...new Set([...newUnitTypes, newUnitTypeInput.trim()])]);
                                                                setNewUnitTypeInput('');
                                                            }
                                                        }}
                                                        placeholder="Add Type (e.g. Double Sharing) + Press Tab"
                                                        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                                    />
                                                    {newUnitTypes.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {newUnitTypes.map(t => (
                                                                <span key={t} className="flex items-center gap-1 text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100">
                                                                    {t} <button type="button" onClick={() => setNewUnitTypes(newUnitTypes.filter(x => x !== t))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button type="submit" disabled={!newUnitId || !newUnitFloor || newUnitTypes.length === 0} className="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                <Plus className="w-4 h-4" /> Add Unit
                                            </button>
                                        </form>
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
        </div>
    );
};

export default PropertyManagementView;
`;

fs.writeFileSync(file, topLines.join('\n') + '\n' + replacement);
