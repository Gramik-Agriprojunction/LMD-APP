import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Switch, ScrollView, StatusBar, TextInput, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatePicker from 'react-native-date-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import ScreenHeader from '../components/ScreenHeader';
import { NavigationEvents, withV4Navigation } from '../utils/v4Compat';
import { screenFooterPadding } from '../utils/safeAreaInsets';
import { consumePendingSelectedFarmer } from '../utils/pendingFarmer';
import {
  DEFAULT_GROUP_BY,
  EMPTY_ENTITY_FILTERS,
  ENTITY_FILTER_FIELDS,
  MAX_GROUP_LAYERS,
  PICK_READY_FILTER,
  PRIORITY_FILTER_OPTIONS,
  RESCHEDULE_DATE_FILTER,
  RESCHEDULE_DATE_PRESETS,
  dedupeGroupStack,
  defaultRescheduleRangeFilter,
  groupFilterById,
  hasActiveFilters,
  entityFilterTextActive,
  normalizeEntityFilters,
  optionsForLayer,
  stackFromLegacy,
} from '../utils/orderGrouping';

const P = '#5D3FD3';
const P_SOFT = '#EDE9FE';
const P_DARK = '#4C1D95';
const TXT = '#0F172A';
const SUB = '#64748B';
const MUTED = '#94A3B8';
const BORDER = '#E8ECF1';
const BG = '#E8ECF4';
const PAD = 10;

const GROUP_SHORT = {
  farmer: 'Farmer',
  darkstore: 'Darkstore',
  drop: 'Drop',
  pincode: 'Pin Code',
  priority: 'Priority',
};

const farmerDisplayName = (farmer) =>
  farmer?.name || farmer?.farmer_name || farmer?.fullName || farmer?.full_name || '';

const toPickerDate = (value) => {
  const m = moment(value, 'YYYY-MM-DD', true);
  return m.isValid() ? m.toDate() : new Date();
};

function SectionCard({ icon, iconTint, title, sub, children }) {
  return (
    <View style={st.section}>
      <View style={st.secHead}>
        <View style={[st.secIco, { backgroundColor: `${iconTint || P}18` }]}>
          <Image source={icon} style={[st.secIcoImg, iconTint ? { tintColor: iconTint } : null]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.secTitle}>{title}</Text>
          {sub ? <Text style={st.secSub}>{sub}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

function GroupOptionRow({ opt, selected, onPress, isLast }) {
  const accent = opt.accent || P;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        st.groupRow,
        !isLast && st.groupRowBorder,
        selected && st.groupRowOn,
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={[st.groupRowIco, { backgroundColor: selected ? '#FFF' : opt.tint }]}>
        <Image
          source={opt.icon}
          style={[st.groupRowImg, { tintColor: selected ? accent : (opt.iconTint || SUB) }]}
        />
      </View>
      <Text style={[st.groupRowT, selected && { color: accent, fontWeight: '700' }]}>
        {GROUP_SHORT[opt.id] || opt.label.replace(' wise', '')}
      </Text>
      <View style={[st.radio, selected && { borderColor: accent, backgroundColor: accent }]}>
        {selected ? <View style={st.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

function GroupPicker({ label, hint, stack, layerIndex, onSelect, onRemove }) {
  const options = optionsForLayer(stack, layerIndex);
  return (
    <View style={layerIndex > 0 ? st.nestedBlock : null}>
      <View style={st.nestedHead}>
        <View style={{ flex: 1 }}>
          <Text style={st.nestedLbl}>{label}</Text>
          {hint ? <Text style={st.nestedHint}>{hint}</Text> : null}
        </View>
        {onRemove ? (
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.nestedRemove}>Hataayein</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={st.groupList}>
        {options.map((opt, index) => (
          <GroupOptionRow
            key={opt.id}
            opt={opt}
            selected={stack[layerIndex] === opt.id}
            onPress={() => onSelect(opt.id)}
            isLast={index === options.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function TagChip({ label, selected, onPress, accent, tint, icon }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[st.tag, selected && { backgroundColor: tint || P_SOFT, borderColor: accent || P }]}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon} size={13} color={selected ? (accent || P) : SUB} />
      ) : null}
      <Text style={[st.tagT, selected && { color: accent || P_DARK, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function OrderFilters({ navigation }) {
  const initialStack = navigation?.getParam?.('groupStack')
    || stackFromLegacy(
      navigation?.getParam?.('groupBy', DEFAULT_GROUP_BY),
      navigation?.getParam?.('subGroupBy', null),
    );
  const initialPickReady = navigation?.getParam?.('pickReadyFilter', null);
  const initialReschedule = navigation?.getParam?.('rescheduleDateFilter', null);
  const initialPriority = navigation?.getParam?.('priorityFilter', null);
  const initialEntity = navigation?.getParam?.('entityFilters', null);
  const onApply = navigation?.getParam?.('onApply');

  const [stackDraft, setStackDraft] = useState(dedupeGroupStack(initialStack));
  const [pickReadyDraft, setPickReadyDraft] = useState(initialPickReady === true);
  const [rescheduleDraft, setRescheduleDraft] = useState(initialReschedule);
  const [priorityDraft, setPriorityDraft] = useState(Array.isArray(initialPriority) ? initialPriority : []);
  const [entityDraft, setEntityDraft] = useState(normalizeEntityFilters(initialEntity || EMPTY_ENTITY_FILTERS));
  const [rangePicker, setRangePicker] = useState(null);

  const showRangePicker = rescheduleDraft?.preset === 'range';
  const previewActive = hasActiveFilters(
    stackDraft[0],
    pickReadyDraft ? true : null,
    rescheduleDraft,
    stackDraft[1],
    stackDraft,
    priorityDraft,
    entityDraft,
  );
  const canAddLayer = stackDraft.length < MAX_GROUP_LAYERS
    && optionsForLayer(stackDraft, stackDraft.length).length > 0;

  const applyPendingFarmer = () => {
    const pending = consumePendingSelectedFarmer();
    if (!pending) return;
    setEntityDraft((prev) => ({ ...prev, farmer: pending }));
  };

  const setLayer = (index, id) => {
    setStackDraft((prev) => dedupeGroupStack([...prev.slice(0, index), id]));
  };

  const addLayer = () => {
    const opts = optionsForLayer(stackDraft, stackDraft.length);
    if (!opts.length) return;
    setStackDraft((prev) => dedupeGroupStack([...prev, opts[0].id]));
  };

  const removeFromLayer = (index) => {
    setStackDraft((prev) => dedupeGroupStack(prev.slice(0, index)));
  };

  const togglePriority = (id) => {
    setPriorityDraft((prev) => (
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    ));
  };

  const setEntityField = (fieldId, value) => {
    setEntityDraft((prev) => normalizeEntityFilters({ ...prev, [fieldId]: value }));
  };

  const clearEntityField = (fieldId) => {
    setEntityDraft((prev) => normalizeEntityFilters({
      ...prev,
      [fieldId]: fieldId === 'farmer' ? null : '',
    }));
  };

  const handlePresetPress = (presetId) => {
    if (rescheduleDraft?.preset === presetId) {
      setRescheduleDraft(null);
      return;
    }
    if (presetId === 'range') {
      setRescheduleDraft(defaultRescheduleRangeFilter());
      return;
    }
    setRescheduleDraft({ preset: presetId });
  };

  const updateRangeDate = (field, date) => {
    setRescheduleDraft({
      ...(rescheduleDraft || defaultRescheduleRangeFilter()),
      preset: 'range',
      [field]: moment(date).format('YYYY-MM-DD'),
    });
    setRangePicker(null);
  };

  const apply = () => {
    const levels = dedupeGroupStack(stackDraft);
    const entityFilters = normalizeEntityFilters(entityDraft);
    onApply?.({
      groupStack: levels,
      groupBy: levels[0],
      subGroupBy: levels[1] || null,
      pickReadyFilter: pickReadyDraft ? true : null,
      rescheduleDateFilter: rescheduleDraft || null,
      priorityFilter: priorityDraft.length ? priorityDraft : null,
      entityFilters: entityFilters.farmer || entityFilterTextActive(entityFilters.darkstore)
        || entityFilters.pincode || entityFilterTextActive(entityFilters.drop)
        ? entityFilters
        : null,
    });
    navigation.goBack();
  };

  const reset = () => {
    setStackDraft([DEFAULT_GROUP_BY]);
    setPickReadyDraft(false);
    setRescheduleDraft(null);
    setPriorityDraft([]);
    setEntityDraft(normalizeEntityFilters(EMPTY_ENTITY_FILTERS));
  };

  const groupPath = dedupeGroupStack(stackDraft)
    .map((id) => GROUP_SHORT[id] || id)
    .join(' › ');

  const textFields = ENTITY_FILTER_FIELDS.filter((f) => f.type !== 'pick');

  return (
    <View style={st.root}>
      <NavigationEvents onDidFocus={applyPendingFarmer} />
      <StatusBar barStyle="light-content" backgroundColor={P} />
      <ScreenHeader bg={P} title="Group & Filter" onBack={() => navigation.goBack()} />

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard
          icon={require('./assets/filter.png')}
          iconTint={P}
          title="Group orders"
          sub={stackDraft.length > 1 || stackDraft[0] !== DEFAULT_GROUP_BY ? groupPath : 'Ek level se shuru karein'}
        >
          <GroupPicker
            label="Pehla level"
            stack={stackDraft}
            layerIndex={0}
            onSelect={(id) => setLayer(0, id)}
          />

          {stackDraft.length >= 2 ? (
            <GroupPicker
              label="Doosra level"
              hint={`Har ${GROUP_SHORT[stackDraft[0]] || 'group'} ke andar`}
              stack={stackDraft}
              layerIndex={1}
              onSelect={(id) => setLayer(1, id)}
              onRemove={() => removeFromLayer(1)}
            />
          ) : null}

          {stackDraft.length >= 3 ? (
            <GroupPicker
              label="Teesra level"
              hint={`Har ${GROUP_SHORT[stackDraft[1]] || 'group'} ke andar`}
              stack={stackDraft}
              layerIndex={2}
              onSelect={(id) => setLayer(2, id)}
              onRemove={() => removeFromLayer(2)}
            />
          ) : null}

          {canAddLayer ? (
            <TouchableOpacity style={st.addBtn} activeOpacity={0.85} onPress={addLayer}>
              <MaterialCommunityIcons name="plus" size={16} color={P} />
              <Text style={st.addBtnT}>Ek aur level jodein</Text>
            </TouchableOpacity>
          ) : null}
        </SectionCard>

        <SectionCard
          icon={require('./assets/search.png')}
          iconTint="#2563EB"
          title="Filter orders"
          sub="Sirf chune hue orders dikhayein"
        >
          <Text style={st.fieldLbl}>Farmer</Text>
          {entityDraft.farmer ? (
            <Pressable
              onPress={() => navigation.navigate('SelectFarmer')}
              style={({ pressed }) => [st.farmerCard, pressed && { opacity: 0.92 }]}
            >
              <View style={st.farmerTop}>
                <View style={st.farmerAvt}>
                  <Image source={require('./assets/farmer.png')} style={st.farmerAvtImg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.farmerName}>{farmerDisplayName(entityDraft.farmer)}</Text>
                  <Text style={st.farmerSub}>Farmer filter lagaa hai</Text>
                </View>
                <TouchableOpacity
                  onPress={() => clearEntityField('farmer')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={MUTED} />
                </TouchableOpacity>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate('SelectFarmer')}
              style={({ pressed }) => [st.farmerEmpty, pressed && { opacity: 0.92 }]}
            >
              <Image source={require('./assets/farmer.png')} style={st.farmerEmptyIco} />
              <View style={{ flex: 1 }}>
                <Text style={st.farmerEmptyT}>Farmer chunein</Text>
                <Text style={st.farmerEmptySub}>List se kisan select karein</Text>
              </View>
              <Image source={require('./assets/arrow.png')} style={st.chevIco} />
            </Pressable>
          )}

          {textFields.map((field) => {
            const textValue = field.type === 'pin'
              ? String(entityDraft[field.id] || '').replace(/\D/g, '').slice(0, 6)
              : String(entityDraft[field.id] || '');
            return (
              <View key={field.id} style={st.fieldBlock}>
                <Text style={st.fieldLbl}>{field.label}</Text>
                <View style={st.inp}>
                  <Image
                    source={field.icon}
                    style={[st.inpIco, field.iconTint ? { tintColor: field.iconTint } : null]}
                  />
                  <TextInput
                    style={st.inpTxt}
                    value={textValue}
                    onChangeText={(text) => {
                      if (field.type === 'pin') {
                        setEntityField(field.id, text.replace(/\D/g, '').slice(0, 6));
                        return;
                      }
                      setEntityField(field.id, text);
                    }}
                    placeholder={field.placeholder}
                    placeholderTextColor={MUTED}
                    keyboardType={field.type === 'pin' ? 'number-pad' : 'default'}
                    maxLength={field.type === 'pin' ? 6 : 120}
                    returnKeyType="done"
                  />
                  {textValue ? (
                    <TouchableOpacity onPress={() => clearEntityField(field.id)}>
                      <MaterialCommunityIcons name="close-circle" size={18} color={MUTED} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })}
        </SectionCard>

        <SectionCard
          icon={require('./assets/star.png')}
          iconTint="#DC2626"
          title="Aur filters"
          sub="Priority, ready to pick, delivery date"
        >
          <Text style={st.fieldLbl}>Priority</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tagRow}>
            {PRIORITY_FILTER_OPTIONS.map((opt) => (
              <TagChip
                key={opt.id}
                label={opt.label}
                icon={opt.icon}
                accent={opt.accent}
                tint={opt.tint}
                selected={priorityDraft.includes(opt.id)}
                onPress={() => togglePriority(opt.id)}
              />
            ))}
          </ScrollView>

          <View style={st.switchCard}>
            <View style={[st.switchIco, pickReadyDraft && { backgroundColor: '#DCFCE7' }]}>
              <Image source={PICK_READY_FILTER.icon} style={[st.switchIcoImg, { tintColor: PICK_READY_FILTER.iconTint }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.switchTitle}>{PICK_READY_FILTER.label}</Text>
              <Text style={st.switchSub}>{PICK_READY_FILTER.sub}</Text>
            </View>
            <Switch
              value={pickReadyDraft}
              onValueChange={setPickReadyDraft}
              trackColor={{ false: '#E2E8F0', true: '#C4B5FD' }}
              thumbColor="#FFF"
              ios_backgroundColor="#E2E8F0"
            />
          </View>

          <Text style={[st.fieldLbl, { marginTop: 10 }]}>{RESCHEDULE_DATE_FILTER.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tagRow}>
            {RESCHEDULE_DATE_PRESETS.map((preset) => (
              <TagChip
                key={preset.id}
                label={preset.label}
                selected={rescheduleDraft?.preset === preset.id}
                onPress={() => handlePresetPress(preset.id)}
              />
            ))}
          </ScrollView>

          {showRangePicker ? (
            <View style={st.rangeBox}>
              <TouchableOpacity style={st.rangeHalf} onPress={() => setRangePicker('from')}>
                <Text style={st.rangeLbl}>From</Text>
                <Text style={st.rangeVal}>
                  {rescheduleDraft?.from ? moment(rescheduleDraft.from).format('DD MMM YY') : 'Date chunein'}
                </Text>
              </TouchableOpacity>
              <View style={st.rangeSep} />
              <TouchableOpacity style={st.rangeHalf} onPress={() => setRangePicker('to')}>
                <Text style={st.rangeLbl}>To</Text>
                <Text style={st.rangeVal}>
                  {rescheduleDraft?.to ? moment(rescheduleDraft.to).format('DD MMM YY') : 'Date chunein'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </SectionCard>

        <View style={{ height: 84 + screenFooterPadding() }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={st.footerSafe}>
        <View style={st.footer}>
          <TouchableOpacity
            style={[st.resetBtn, !previewActive && st.resetBtnOff]}
            onPress={reset}
            disabled={!previewActive}
          >
            <Text style={[st.resetT, !previewActive && { color: MUTED }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.applyBtn} activeOpacity={0.9} onPress={apply}>
            <Text style={st.applyT}>Apply</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <DatePicker
        modal
        open={!!rangePicker}
        date={toPickerDate(rangePicker === 'to' ? rescheduleDraft?.to : rescheduleDraft?.from)}
        mode="date"
        onConfirm={(date) => updateRangeDate(rangePicker, date)}
        onCancel={() => setRangePicker(null)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: PAD, paddingTop: 8, paddingBottom: PAD, gap: 8 },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  secHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  secIco: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  secIcoImg: { width: 16, height: 16, resizeMode: 'contain', tintColor: P },
  secTitle: { fontSize: 14, fontWeight: '700', color: TXT },
  secSub: { fontSize: 11.5, color: SUB, marginTop: 1 },
  nestedBlock: { marginTop: 8 },
  nestedHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  nestedLbl: { fontSize: 12.5, fontWeight: '600', color: TXT },
  nestedHint: { fontSize: 11, color: MUTED, marginTop: 1 },
  nestedRemove: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  groupList: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FAFBFC',
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: '#FFF',
  },
  groupRowOn: { backgroundColor: '#FAFAFF' },
  groupRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  groupRowIco: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRowImg: { width: 16, height: 16, resizeMode: 'contain' },
  groupRowT: { flex: 1, fontSize: 13.5, fontWeight: '500', color: TXT },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: P_SOFT,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  addBtnT: { fontSize: 13, fontWeight: '600', color: P },
  fieldBlock: { marginTop: 8, width: '100%', alignSelf: 'stretch' },
  fieldLbl: { fontSize: 11.5, fontWeight: '500', color: SUB, marginBottom: 4 },
  inp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    minHeight: 44,
    gap: 8,
  },
  inpIco: { width: 16, height: 16, resizeMode: 'contain', flexShrink: 0 },
  inpTxt: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    fontWeight: '500',
    color: TXT,
    paddingVertical: Platform.OS === 'android' ? 8 : 10,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
  },
  farmerEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D7CCF7',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 9,
    backgroundColor: P_SOFT,
    gap: 10,
  },
  farmerEmptyIco: { width: 22, height: 22, resizeMode: 'contain' },
  farmerEmptyT: { fontSize: 13.5, fontWeight: '600', color: P },
  farmerEmptySub: { fontSize: 11, color: SUB, marginTop: 2 },
  farmerCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 9,
    backgroundColor: '#FAFBFC',
  },
  farmerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  farmerAvt: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: P_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  farmerAvtImg: { width: 22, height: 22, resizeMode: 'contain' },
  farmerName: { fontSize: 14, fontWeight: '700', color: TXT },
  farmerSub: { fontSize: 11, color: SUB, marginTop: 2 },
  chevIco: { width: 14, height: 14, tintColor: MUTED, resizeMode: 'contain' },
  tagRow: { gap: 8, paddingRight: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFC',
  },
  tagT: { fontSize: 12.5, fontWeight: '500', color: SUB },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFBFC',
  },
  switchIco: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchIcoImg: { width: 18, height: 18, resizeMode: 'contain' },
  switchTitle: { fontSize: 13.5, fontWeight: '600', color: TXT },
  switchSub: { fontSize: 11, color: SUB, marginTop: 2, lineHeight: 15 },
  rangeBox: {
    flexDirection: 'row',
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#FAFBFC',
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
  },
  rangeHalf: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  rangeSep: { width: 1, backgroundColor: BORDER },
  rangeLbl: { fontSize: 10, fontWeight: '600', color: MUTED, textTransform: 'uppercase' },
  rangeVal: { fontSize: 13, fontWeight: '600', color: TXT, marginTop: 3 },
  footerSafe: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: BORDER },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 6 },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFC',
  },
  resetBtnOff: { opacity: 0.55 },
  resetT: { fontSize: 14, fontWeight: '600', color: SUB },
  applyBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 12,
    backgroundColor: P,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyT: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});

export default withV4Navigation(OrderFilters);
