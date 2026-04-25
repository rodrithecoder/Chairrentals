import { useState, useEffect } from "react";

const CHAIR_RATE = 3;
const TABLE_RATE = 15;
const STORAGE_KEY = "chair_table_bookings_v1";
const SETTINGS_KEY = "chair_table_settings_v1";

// ─── Persistence ─────────────────────────────────────────────────────────────

function loadBookings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}
function persistBookings(b) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch {}
}

const today = new Date().toISOString().split("T")[0];

const DEFAULT_SETTINGS = {
  chairInventory: 80,
  tableInventory: 2,
  startDate: today,
  endDate: (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 4); d.setDate(0);
    return d.toISOString().split("T")[0];
  })(),
};

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return DEFAULT_SETTINGS; }
}
function persistSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() { return Math.random().toString(36).substr(2, 9); }

function formatDate(ds) {
  const [y, m, d] = ds.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateShort(ds) {
  const [y, m, d] = ds.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

function daysBetween(start, end) {
  return Math.round((new Date(end + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000) + 1;
}

function getMonthsBetween(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const months = [];
  const cur = new Date(new Date(startDate + "T00:00:00").getFullYear(), new Date(startDate + "T00:00:00").getMonth(), 1);
  const endMonth = new Date(new Date(endDate + "T00:00:00").getFullYear(), new Date(endDate + "T00:00:00").getMonth(), 1);
  while (cur <= endMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

function resourceOnDate(bookings, date, key) {
  return bookings
    .filter(b => b.startDate <= date && b.endDate >= date)
    .reduce((s, b) => s + (b[key] || 0), 0);
}

function maxResourceInRange(bookings, start, end, key, excludeId = null) {
  let max = 0;
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    const ds = cur.toISOString().split("T")[0];
    const used = bookings.filter(b => b.id !== excludeId && b.startDate <= ds && b.endDate >= ds).reduce((s, b) => s + (b[key] || 0), 0);
    max = Math.max(max, used);
    cur.setDate(cur.getDate() + 1);
  }
  return max;
}

function calcCosts(chairs, tables, serviceType, deliveryFee, discount) {
  const chairCost = (parseInt(chairs) || 0) * CHAIR_RATE;
  const tableCost = (parseInt(tables) || 0) * TABLE_RATE;
  const fee = serviceType === "delivery" ? (parseFloat(deliveryFee) || 0) : 0;
  const subtotal = chairCost + tableCost + fee;
  const discountAmt = subtotal * ((parseFloat(discount) || 0) / 100);
  return { chairCost, tableCost, deliveryFee: fee, discountAmount: discountAmt, totalCost: subtotal - discountAmt };
}

const EMPTY_FORM = {
  name: "", salesRep: "", startDate: "", endDate: "",
  chairs: "", tables: "", serviceType: "pickup",
  deliveryFee: "", address: "", discount: "", notes: "",
};

// ─── useWindowWidth hook ──────────────────────────────────────────────────────

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

// Breakpoints
// phone   < 640
// tablet  640–1023
// desktop >= 1024

// ─── Shared styles ────────────────────────────────────────────────────────────

const inp = (isMobile) => ({
  width: "100%", background: "#1a1a2e", border: "1px solid #2a2a4a",
  borderRadius: 8, padding: isMobile ? "11px 12px" : "8px 10px", color: "#e8e0d5",
  fontSize: isMobile ? 16 : 13, fontFamily: "Georgia,serif",
  boxSizing: "border-box", outline: "none", WebkitAppearance: "none",
});

function Field({ label, error, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && !error && <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ {error}</div>}
    </div>
  );
}

function CostRow({ label, value, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: "#7b8fa1" }}>{label}</span>
      <span style={{ color: accent || "#e8e0d5" }}>{value < 0 ? `-$${Math.abs(value).toFixed(2)}` : `$${value.toFixed(2)}`}</span>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const width = useWindowWidth();
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;
  const stacked = !isDesktop; // sidebar stacks on phone + tablet portrait

  const [bookings, setBookings] = useState(loadBookings);
  const [settings, setSettings] = useState(loadSettings);
  const [draft, setDraft] = useState(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsErr, setSettingsErr] = useState("");
  const [form, setFormRaw] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // Mobile uses bottom nav: "calendar" | "list" | "form"
  const [mobileTab, setMobileTab] = useState("calendar");
  const [calMonth, setCalMonth] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");

  const { chairInventory, tableInventory, startDate, endDate } = settings;
  const setForm = patch => setFormRaw(p => ({ ...p, ...patch }));
  function saveBookings(b) { setBookings(b); persistBookings(b); }

  function applySettings() {
    const ci = parseInt(draft.chairInventory), ti = parseInt(draft.tableInventory);
    if (!draft.startDate || !draft.endDate) { setSettingsErr("Both dates required."); return; }
    if (draft.startDate > draft.endDate) { setSettingsErr("Start must be before end."); return; }
    if (!ci || ci < 1) { setSettingsErr("Chair inventory must be ≥ 1."); return; }
    if (!ti || ti < 1) { setSettingsErr("Table inventory must be ≥ 1."); return; }
    const s = { ...draft, chairInventory: ci, tableInventory: ti };
    setSettings(s); persistSettings(s);
    setSettingsOpen(false); setSettingsErr(""); setCalMonth(0);
  }

  const months = getMonthsBetween(startDate, endDate);
  const safeMonth = Math.min(calMonth, Math.max(0, months.length - 1));

  function validate() {
    const e = {}, f = form;
    if (!f.name.trim()) e.name = "Required";
    if (!f.salesRep.trim()) e.salesRep = "Required";
    if (!f.startDate) e.startDate = "Required";
    if (!f.endDate) e.endDate = "Required";
    if (f.startDate && f.endDate && f.startDate > f.endDate) e.endDate = "End must be after start";
    if (f.startDate && (f.startDate < startDate || f.startDate > endDate)) e.startDate = "Outside allowed range";
    if (f.endDate && f.endDate > endDate) e.endDate = "Outside allowed range";
    const chairs = parseInt(f.chairs) || 0;
    const tables = parseInt(f.tables) || 0;
    if (chairs === 0 && tables === 0) e.chairs = "Enter at least chairs or tables";
    if (chairs > chairInventory) e.chairs = `Max ${chairInventory} chairs`;
    if (tables > tableInventory) e.tables = `Max ${tableInventory} tables`;
    if (f.startDate && f.endDate && f.startDate <= f.endDate) {
      if (chairs > 0) {
        const mx = maxResourceInRange(bookings, f.startDate, f.endDate, "chairs");
        if (chairs > chairInventory - mx) e.chairs = `Only ${chairInventory - mx} chairs available`;
      }
      if (tables > 0) {
        const mx = maxResourceInRange(bookings, f.startDate, f.endDate, "tables");
        if (tables > tableInventory - mx) e.tables = `Only ${tableInventory - mx} tables available`;
      }
    }
    if (f.serviceType === "delivery" && f.deliveryFee !== "" && isNaN(f.deliveryFee)) e.deliveryFee = "Invalid amount";
    if (f.discount !== "" && (isNaN(f.discount) || +f.discount < 0 || +f.discount > 100)) e.discount = "0–100 only";
    return e;
  }

  function handleSubmit() {
    const e = validate(); setErrors(e);
    if (Object.keys(e).length) return;
    const chairs = parseInt(form.chairs) || 0;
    const tables = parseInt(form.tables) || 0;
    const costs = calcCosts(chairs, tables, form.serviceType, form.deliveryFee, form.discount);
    saveBookings([...bookings, {
      id: generateId(), name: form.name.trim(), salesRep: form.salesRep.trim(),
      startDate: form.startDate, endDate: form.endDate,
      days: daysBetween(form.startDate, form.endDate),
      chairs, tables, serviceType: form.serviceType,
      address: form.serviceType === "delivery" ? form.address.trim() : "",
      notes: form.notes.trim(), discount: parseFloat(form.discount) || 0, ...costs,
    }].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    setFormRaw(EMPTY_FORM); setErrors({});
    setSuccessMsg("Booking added!");
    setTimeout(() => setSuccessMsg(""), 3000);
    if (isMobile) setMobileTab("list");
  }

  const rentalDays = form.startDate && form.endDate && form.startDate <= form.endDate
    ? daysBetween(form.startDate, form.endDate) : null;
  const availChairs = form.startDate && form.endDate && form.startDate <= form.endDate
    ? chairInventory - maxResourceInRange(bookings, form.startDate, form.endDate, "chairs") : null;
  const availTables = form.startDate && form.endDate && form.startDate <= form.endDate
    ? tableInventory - maxResourceInRange(bookings, form.startDate, form.endDate, "tables") : null;
  const chairs = parseInt(form.chairs) || 0;
  const tables = parseInt(form.tables) || 0;
  const preview = (chairs > 0 || tables > 0)
    ? calcCosts(chairs, tables, form.serviceType, form.deliveryFee, form.discount) : null;
  const totalRevenue = bookings.reduce((s, b) => s + b.totalCost, 0);
  const am = months[safeMonth];

  function capColor(cu, tu) {
    const p = Math.max(chairInventory > 0 ? cu / chairInventory : 0, tableInventory > 0 ? tu / tableInventory : 0);
    if (p === 0) return "#1a1a2e";
    if (p < 0.5) return "#0f4c3a";
    if (p < 0.8) return "#7a4f00";
    return "#6b0f1a";
  }

  const inputStyle = inp(isMobile);

  // ── Form panel (shared between desktop sidebar and mobile screen) ────────────
  const FormPanel = () => (
    <div style={{ padding: stacked ? (isMobile ? "16px" : "20px 24px") : "18px 16px", overflowY: "auto", flex: 1 }}>

      {/* Settings accordion */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => { setSettingsOpen(o => !o); setDraft(settings); setSettingsErr(""); }}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: settingsOpen ? "8px 8px 0 0" : 8, padding: "11px 14px", cursor: "pointer", fontFamily: "Georgia,serif", color: "#7b8fa1", fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
          <span>⚙ Settings</span><span>{settingsOpen ? "▲" : "▼"}</span>
        </button>
        {settingsOpen && (
          <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "16px 14px" }}>
            <Field label="Allowed Start Date">
              <input type="date" style={inputStyle} value={draft.startDate} onChange={e => setDraft(d => ({ ...d, startDate: e.target.value }))} />
            </Field>
            <Field label="Allowed End Date">
              <input type="date" style={inputStyle} value={draft.endDate} onChange={e => setDraft(d => ({ ...d, endDate: e.target.value }))} />
              {draft.startDate && draft.endDate && draft.startDate <= draft.endDate && (
                <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 3 }}>{getMonthsBetween(draft.startDate, draft.endDate).length} month(s) shown</div>
              )}
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="🪑 Chair Inventory">
                <input type="number" style={inputStyle} min={1} max={9999} value={draft.chairInventory} onChange={e => setDraft(d => ({ ...d, chairInventory: e.target.value }))} />
              </Field>
              <Field label="🪵 Table Inventory">
                <input type="number" style={inputStyle} min={1} max={9999} value={draft.tableInventory} onChange={e => setDraft(d => ({ ...d, tableInventory: e.target.value }))} />
              </Field>
            </div>
            <div style={{ fontSize: 11, color: "#7b8fa1", marginBottom: 12 }}>🪑 $3 flat &nbsp;·&nbsp; 🪵 $15 flat</div>
            {settingsErr && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 10 }}>⚠ {settingsErr}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setSettingsOpen(false); setSettingsErr(""); }}
                style={{ flex: 1, padding: "10px", background: "none", border: "1px solid #2a2a4a", color: "#7b8fa1", borderRadius: 8, cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 13 }}>Cancel</button>
              <button onClick={applySettings}
                style={{ flex: 2, padding: "10px", background: "#0f3460", border: "1px solid #4db8a8", color: "#4db8a8", borderRadius: 8, cursor: "pointer", fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 13 }}>Save</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, letterSpacing: 3, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 14 }}>New Booking</div>

      {successMsg && (
        <div style={{ background: "#0f4c3a", border: "1px solid #4db8a8", borderRadius: 8, padding: "10px 14px", color: "#4db8a8", fontSize: 13, marginBottom: 14 }}>✓ {successMsg}</div>
      )}

      <Field label="Customer Name" error={errors.name}>
        <input style={inputStyle} placeholder="e.g. Johnson Wedding" value={form.name} onChange={e => setForm({ name: e.target.value })} />
      </Field>
      <Field label="Sales Rep" error={errors.salesRep}>
        <input style={inputStyle} placeholder="e.g. Maria Lopez" value={form.salesRep} onChange={e => setForm({ salesRep: e.target.value })} />
      </Field>

      {/* Dates */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 5 }}>Start Date</label>
          <input type="date" style={inputStyle} min={startDate} max={endDate} value={form.startDate}
            onChange={e => setForm({ startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })} />
          {errors.startDate && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ {errors.startDate}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 5 }}>End Date</label>
          <input type="date" style={inputStyle} min={form.startDate || startDate} max={endDate} value={form.endDate}
            onChange={e => setForm({ endDate: e.target.value })} />
          {errors.endDate && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ {errors.endDate}</div>}
        </div>
      </div>

      {rentalDays && (
        <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#7b8fa1", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
          <span>Rental duration</span>
          <b style={{ color: "#4db8a8" }}>{rentalDays} day{rentalDays > 1 ? "s" : ""}</b>
        </div>
      )}

      {/* Chairs & Tables */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 5 }}>🪑 Chairs</label>
          <input type="number" style={inputStyle} min={0} max={chairInventory} placeholder="0" value={form.chairs} onChange={e => setForm({ chairs: e.target.value })} />
          {availChairs !== null && <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 4 }}>Avail: <b style={{ color: "#4db8a8" }}>{availChairs}</b></div>}
          {errors.chairs && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ {errors.chairs}</div>}
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 5 }}>🪵 Tables</label>
          <input type="number" style={inputStyle} min={0} max={tableInventory} placeholder="0" value={form.tables} onChange={e => setForm({ tables: e.target.value })} />
          {availTables !== null && <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 4 }}>Avail: <b style={{ color: "#c084fc" }}>{availTables}</b></div>}
          {errors.tables && <div style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>⚠ {errors.tables}</div>}
        </div>
      </div>

      {/* Service type */}
      <Field label="Service Type">
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a4a" }}>
          {["pickup", "delivery"].map(t => (
            <button key={t} onClick={() => setForm({ serviceType: t, deliveryFee: "", address: "" })}
              style={{ flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontSize: isMobile ? 14 : 12, fontFamily: "Georgia,serif", fontWeight: 600, background: form.serviceType === t ? "#0f3460" : "#1a1a2e", color: form.serviceType === t ? "#4db8a8" : "#7b8fa1", transition: "all 0.2s" }}>
              {t === "pickup" ? "🚶 Pickup" : "📦 Delivery"}
            </button>
          ))}
        </div>
      </Field>

      {form.serviceType === "delivery" && <>
        <Field label="Delivery Fee ($)" error={errors.deliveryFee}>
          <input type="number" style={inputStyle} min={0} step="0.01" placeholder="0.00" value={form.deliveryFee} onChange={e => setForm({ deliveryFee: e.target.value })} />
        </Field>
        <Field label="Delivery Address">
          <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.5 }} placeholder="Street, City, ZIP…" value={form.address} onChange={e => setForm({ address: e.target.value })} />
        </Field>
      </>}

      <Field label="Discount (%)" error={errors.discount}>
        <input type="number" style={inputStyle} min={0} max={100} placeholder="Optional (0–100)" value={form.discount} onChange={e => setForm({ discount: e.target.value })} />
      </Field>

      <Field label="Notes">
        <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 60, lineHeight: 1.5 }} placeholder="Special requirements…" value={form.notes} onChange={e => setForm({ notes: e.target.value })} />
      </Field>

      {preview && (
        <div style={{ background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 8, padding: "14px", marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 10 }}>Cost Preview</div>
          {chairs > 0 && <CostRow label={`🪑 ${chairs} chair${chairs > 1 ? "s" : ""} × $${CHAIR_RATE}`} value={preview.chairCost} />}
          {tables > 0 && <CostRow label={`🪵 ${tables} table${tables > 1 ? "s" : ""} × $${TABLE_RATE}`} value={preview.tableCost} />}
          {form.serviceType === "delivery" && <CostRow label="Delivery fee" value={preview.deliveryFee} />}
          {preview.discountAmount > 0 && <CostRow label={`Discount (${form.discount}%)`} value={-preview.discountAmount} accent="#f87171" />}
          <div style={{ borderTop: "1px solid #2a2a4a", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Total</span>
            <span style={{ color: "#f0a500", fontSize: 16 }}>${preview.totalCost.toFixed(2)}</span>
          </div>
        </div>
      )}

      <button onClick={handleSubmit}
        style={{ width: "100%", background: "linear-gradient(135deg,#0f3460,#16213e)", border: "1px solid #4db8a8", color: "#4db8a8", padding: isMobile ? "14px" : "11px", borderRadius: 10, cursor: "pointer", fontFamily: "Georgia,serif", fontSize: isMobile ? 15 : 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: isMobile ? 24 : 0 }}>
        + Add Booking
      </button>
    </div>
  );

  // ── Calendar panel ────────────────────────────────────────────────────────────
  const CalendarPanel = () => (
    <div style={{ padding: isMobile ? "14px" : "24px 28px", overflowX: "hidden" }}>
      {months.length === 0
        ? <div style={{ textAlign: "center", padding: "40px 0", color: "#7b8fa1" }}>Open ⚙ Settings to set a date range.</div>
        : <>
          {/* Month selector - scrollable row on mobile */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch" }}>
            {months.map((m, i) => {
              const lbl = new Date(m.year, m.month, 1).toLocaleDateString("en-US", { month: isMobile ? "short" : "long", year: "numeric" });
              return (
                <button key={i} onClick={() => setCalMonth(i)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid", borderColor: safeMonth === i ? "#f0a500" : "#2a2a4a", background: safeMonth === i ? "#2a1f00" : "#1a1a2e", color: safeMonth === i ? "#f0a500" : "#7b8fa1", cursor: "pointer", fontSize: 12, fontFamily: "Georgia,serif", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {lbl}
                </button>
              );
            })}
          </div>

          {am && (() => {
            const { year, month } = am;
            const dim = getDaysInMonth(year, month);
            const firstDay = new Date(year, month, 1).getDay();
            return <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: isMobile ? 3 : 5 }}>
                {(isMobile ? ["S","M","T","W","T","F","S"] : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]).map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 10, color: "#7b8fa1", letterSpacing: 1, paddingBottom: 5 }}>{d}</div>
                ))}
                {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array(dim).fill(null).map((_, i) => {
                  const day = i + 1;
                  const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const cu = resourceOnDate(bookings, ds, "chairs");
                  const tu = resourceOnDate(bookings, ds, "tables");
                  const dayBookings = bookings.filter(b => b.startDate <= ds && b.endDate >= ds);
                  const oor = ds < startDate || ds > endDate;
                  const isPast = ds < today;
                  const isToday = ds === today;
                  const cp = chairInventory > 0 ? cu / chairInventory : 0;
                  const tp = tableInventory > 0 ? tu / tableInventory : 0;
                  return (
                    <div key={day} style={{ background: oor ? "#0d0d14" : isPast ? "#111118" : capColor(cu, tu), border: isToday ? "2px solid #f0a500" : "1px solid #2a2a4a", borderRadius: isMobile ? 5 : 7, padding: isMobile ? "4px 3px" : "6px 5px", minHeight: isMobile ? 54 : 76, opacity: oor ? 0.15 : isPast ? 0.45 : 1 }}>
                      <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: isToday ? "#f0a500" : "#e8e0d5" }}>{day}</div>
                      {!oor && cu > 0 && (
                        <div style={{ marginTop: 2 }}>
                          <div style={{ fontSize: 8, color: "#4db8a8" }}>🪑{cu}</div>
                          <div style={{ height: 2, background: "#2a2a4a", borderRadius: 1, marginTop: 1 }}>
                            <div style={{ height: 2, borderRadius: 1, width: `${Math.min(cp * 100, 100)}%`, background: cp > 0.8 ? "#f87171" : cp > 0.5 ? "#f0a500" : "#4db8a8" }} />
                          </div>
                        </div>
                      )}
                      {!oor && tu > 0 && (
                        <div style={{ marginTop: 2 }}>
                          <div style={{ fontSize: 8, color: "#c084fc" }}>🪵{tu}</div>
                          <div style={{ height: 2, background: "#2a2a4a", borderRadius: 1, marginTop: 1 }}>
                            <div style={{ height: 2, borderRadius: 1, width: `${Math.min(tp * 100, 100)}%`, background: tp > 0.8 ? "#f87171" : tp > 0.5 ? "#f0a500" : "#c084fc" }} />
                          </div>
                        </div>
                      )}
                      {!isMobile && dayBookings.slice(0, 1).map(b => (
                        <div key={b.id} style={{ fontSize: 8, color: "#b0b8c8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {b.name}</div>
                      ))}
                      {!isMobile && dayBookings.length > 1 && <div style={{ fontSize: 8, color: "#7b8fa1" }}>+{dayBookings.length - 1}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                {[{ c: "#0f4c3a", l: "< 50%" }, { c: "#7a4f00", l: "50–80%" }, { c: "#6b0f1a", l: "> 80%" }].map(x => (
                  <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 9, height: 9, borderRadius: 2, background: x.c, border: "1px solid #2a2a4a" }} />
                    <span style={{ fontSize: 10, color: "#7b8fa1" }}>{x.l}</span>
                  </div>
                ))}
                <span style={{ fontSize: 10, color: "#7b8fa1" }}>🪑 chairs · 🪵 tables</span>
              </div>
            </>;
          })()}
        </>
      }
    </div>
  );

  // ── Bookings list panel ───────────────────────────────────────────────────────
  const ListPanel = () => (
    <div style={{ padding: isMobile ? "14px" : "24px 28px" }}>
      {bookings.length === 0
        ? <div style={{ textAlign: "center", padding: "50px 0", color: "#7b8fa1" }}><div style={{ fontSize: 40, marginBottom: 10 }}>🪑</div>No bookings yet.</div>
        : <>
          {/* Mobile card view */}
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bookings.map(b => (
                <div key={b.id} style={{ background: "#13131f", border: "1px solid #2a2a4a", borderRadius: 12, padding: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#e8e0d5" }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: "#7b8fa1", marginTop: 2 }}>{b.salesRep}</div>
                    </div>
                    <button onClick={() => saveBookings(bookings.filter(x => x.id !== b.id))}
                      style={{ background: "none", border: "1px solid #3a1a1a", color: "#f87171", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: "#7b8fa1", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Period</div>
                      <div style={{ fontSize: 12, color: "#b0b8c8" }}>{formatDateShort(b.startDate)} → {formatDateShort(b.endDate)}</div>
                      <div style={{ fontSize: 11, color: "#7b8fa1" }}>{b.days} day{b.days > 1 ? "s" : ""}</div>
                    </div>
                    <div style={{ background: "#1a1a2e", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ fontSize: 10, color: "#7b8fa1", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>Items</div>
                      {b.chairs > 0 && <div style={{ fontSize: 12, color: "#4db8a8" }}>🪑 {b.chairs} chairs</div>}
                      {b.tables > 0 && <div style={{ fontSize: 12, color: "#c084fc" }}>🪵 {b.tables} tables</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: b.serviceType === "delivery" ? "#1a1a2e" : "#0f3030", color: b.serviceType === "delivery" ? "#f0a500" : "#4db8a8", border: `1px solid ${b.serviceType === "delivery" ? "#f0a500" : "#4db8a8"}` }}>
                      {b.serviceType === "delivery" ? "📦 Delivery" : "🚶 Pickup"}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      {b.discount > 0 && <div style={{ fontSize: 11, color: "#f87171" }}>-{b.discount}% disc.</div>}
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#f0a500" }}>${b.totalCost.toFixed(2)}</div>
                    </div>
                  </div>
                  {b.address && <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 6 }}>📍 {b.address}</div>}
                  {b.notes && <div style={{ fontSize: 11, color: "#7b8fa1", marginTop: 4, fontStyle: "italic" }}>{b.notes}</div>}
                </div>
              ))}
            </div>
          ) : (
            /* Desktop/tablet table view */
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2a2a4a" }}>
                    {["Customer", "Sales Rep", "Rental Period", "Days", "🪑", "🪵", "Service", "Chair $", "Table $", "Delivery", "Disc.", "Total", ""].map(h => (
                      <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, letterSpacing: 1, color: "#7b8fa1", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #1a1a2e", background: i % 2 === 0 ? "#13131f" : "#111118" }}>
                      <td style={{ padding: "11px 10px", fontWeight: 600, color: "#e8e0d5" }}>
                        {b.name}
                        {b.notes && <div style={{ fontSize: 10, color: "#7b8fa1", fontWeight: 400 }}>{b.notes}</div>}
                      </td>
                      <td style={{ padding: "11px 10px", color: "#b0b8c8" }}>{b.salesRep || "—"}</td>
                      <td style={{ padding: "11px 10px", color: "#b0b8c8", whiteSpace: "nowrap" }}>{formatDateShort(b.startDate)} → {formatDateShort(b.endDate)}</td>
                      <td style={{ padding: "11px 10px", color: "#7b8fa1", textAlign: "center" }}>{b.days}</td>
                      <td style={{ padding: "11px 10px", color: "#4db8a8", fontWeight: 700 }}>{b.chairs || "—"}</td>
                      <td style={{ padding: "11px 10px", color: "#c084fc", fontWeight: 700 }}>{b.tables || "—"}</td>
                      <td style={{ padding: "11px 10px" }}>
                        <span style={{ padding: "2px 7px", borderRadius: 20, fontSize: 10, background: b.serviceType === "delivery" ? "#1a1a2e" : "#0f3030", color: b.serviceType === "delivery" ? "#f0a500" : "#4db8a8", border: `1px solid ${b.serviceType === "delivery" ? "#f0a500" : "#4db8a8"}` }}>
                          {b.serviceType === "delivery" ? "📦" : "🚶"}
                        </span>
                        {b.address && <div style={{ fontSize: 10, color: "#7b8fa1", marginTop: 2 }}>{b.address}</div>}
                      </td>
                      <td style={{ padding: "11px 10px", color: "#b0b8c8" }}>{b.chairCost > 0 ? `$${b.chairCost.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "11px 10px", color: "#b0b8c8" }}>{b.tableCost > 0 ? `$${b.tableCost.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "11px 10px", color: "#b0b8c8" }}>{b.serviceType === "delivery" ? `$${b.deliveryFee.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "11px 10px", color: b.discount > 0 ? "#f87171" : "#b0b8c8" }}>{b.discount > 0 ? `-${b.discount}%` : "—"}</td>
                      <td style={{ padding: "11px 10px", fontWeight: 700, color: "#f0a500" }}>${b.totalCost.toFixed(2)}</td>
                      <td style={{ padding: "11px 10px" }}>
                        <button onClick={() => saveBookings(bookings.filter(x => x.id !== b.id))}
                          style={{ background: "none", border: "1px solid #3a1a1a", color: "#f87171", borderRadius: 5, padding: "3px 7px", cursor: "pointer", fontSize: 11 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div style={{ marginTop: 16, background: "#1a1a2e", border: "1px solid #2a2a4a", borderRadius: 10, padding: "14px 16px", display: "flex", gap: isMobile ? 16 : 28, flexWrap: "wrap" }}>
            <div style={{ fontSize: 10, letterSpacing: 3, color: "#7b8fa1", textTransform: "uppercase", width: "100%", marginBottom: 4 }}>Summary</div>
            {[
              { l: "Bookings", v: bookings.length, c: "#4db8a8" },
              { l: "🪑 Chairs", v: bookings.reduce((s, b) => s + (b.chairs || 0), 0), c: "#4db8a8" },
              { l: "🪵 Tables", v: bookings.reduce((s, b) => s + (b.tables || 0), 0), c: "#c084fc" },
              { l: "Revenue", v: `$${totalRevenue.toFixed(2)}`, c: "#f0a500" },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: isMobile ? 20 : 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 10, color: "#7b8fa1", letterSpacing: 1, textTransform: "uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </>
      }
    </div>
  );

  // ── Header ────────────────────────────────────────────────────────────────────
  const Header = () => (
    <div style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)", borderBottom: "1px solid #2a2a4a", padding: isMobile ? "12px 16px" : "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
      <div>
        {!isMobile && <div style={{ fontSize: 10, letterSpacing: 4, color: "#7b8fa1", textTransform: "uppercase", marginBottom: 2 }}>Booking Manager</div>}
        <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 700 }}>🪑 Chairs & Tables</div>
      </div>
      <div style={{ display: "flex", gap: isMobile ? 12 : 20, flexWrap: "wrap" }}>
        {[
          { l: "Chairs", v: chairInventory, c: "#7b8fa1" },
          { l: "Tables", v: tableInventory, c: "#7b8fa1" },
          { l: "Bookings", v: bookings.length, c: "#4db8a8" },
          ...(isMobile ? [] : [{ l: "Revenue", v: `$${totalRevenue.toFixed(2)}`, c: "#f0a500" }]),
        ].map(s => (
          <div key={s.l} style={{ textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 14 : 17, fontWeight: 700, color: s.c }}>{s.v}</div>
            <div style={{ fontSize: 9, color: "#7b8fa1", letterSpacing: 1, textTransform: "uppercase" }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Bottom nav for mobile ─────────────────────────────────────────────────────
  const BottomNav = () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#13131f", borderTop: "1px solid #2a2a4a", display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }}>
      {[
        { id: "calendar", icon: "📅", label: "Calendar" },
        { id: "list", icon: "📋", label: "Bookings" },
        { id: "form", icon: "➕", label: "New" },
      ].map(t => (
        <button key={t.id} onClick={() => setMobileTab(t.id)}
          style={{ flex: 1, padding: "10px 0 8px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 10, letterSpacing: 1, color: mobileTab === t.id ? "#4db8a8" : "#7b8fa1", fontFamily: "Georgia,serif", textTransform: "uppercase", fontWeight: mobileTab === t.id ? 700 : 400 }}>{t.label}</span>
          {mobileTab === t.id && <div style={{ width: 20, height: 2, background: "#4db8a8", borderRadius: 1 }} />}
        </button>
      ))}
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────────

  // PHONE layout
  if (isMobile) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", color: "#e8e0d5", fontFamily: "Georgia,serif", paddingBottom: 70 }}>
        <Header />
        {mobileTab === "calendar" && <CalendarPanel />}
        {mobileTab === "list" && <ListPanel />}
        {mobileTab === "form" && <FormPanel />}
        <BottomNav />
      </div>
    );
  }

  // TABLET + DESKTOP: sidebar on left, content on right
  // On tablet: sidebar is collapsible via a tab strip at top
  const [tabletView, setTabletView] = useState("calendar"); // "calendar" | "list" | "form"

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d14", color: "#e8e0d5", fontFamily: "Georgia,serif", display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar — always visible on desktop, toggled on tablet */}
        {(isDesktop || tabletView === "form") && (
          <div style={{ width: isDesktop ? 320 : "100%", maxWidth: isDesktop ? 320 : "none", background: "#13131f", borderRight: isDesktop ? "1px solid #2a2a4a" : "none", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <FormPanel />
          </div>
        )}

        {/* Main content */}
        {(isDesktop || tabletView !== "form") && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Tab bar — shown on tablet only */}
            {isTablet && (
              <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderBottom: "1px solid #2a2a4a", background: "#13131f" }}>
                {[{ id: "calendar", label: "📅 Calendar" }, { id: "list", label: "📋 Bookings" }, { id: "form", label: "➕ New Booking" }].map(t => (
                  <button key={t.id} onClick={() => setTabletView(t.id)}
                    style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid", borderColor: tabletView === t.id ? "#4db8a8" : "#2a2a4a", background: tabletView === t.id ? "#0f3460" : "#13131f", color: tabletView === t.id ? "#4db8a8" : "#7b8fa1", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 13, fontWeight: 600 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop tabs */}
            {isDesktop && (
              <div style={{ display: "flex", gap: 8, padding: "16px 28px 0", }}>
                {[{ id: "calendar", label: "📅 Calendar" }, { id: "list", label: "📋 Bookings List" }].map(t => (
                  <button key={t.id} onClick={() => setTabletView(t.id)}
                    style={{ padding: "7px 18px", borderRadius: 8, border: "1px solid", borderColor: tabletView === t.id ? "#4db8a8" : "#2a2a4a", background: tabletView === t.id ? "#0f3460" : "#13131f", color: tabletView === t.id ? "#4db8a8" : "#7b8fa1", cursor: "pointer", fontFamily: "Georgia,serif", fontSize: 13, fontWeight: 600 }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto" }}>
              {(tabletView === "calendar" || (isTablet && tabletView === "calendar")) && <CalendarPanel />}
              {(tabletView === "list") && <ListPanel />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
