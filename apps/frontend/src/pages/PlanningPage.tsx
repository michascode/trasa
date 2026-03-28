import { DragEvent, FormEvent, useEffect, useMemo, useState } from 'react';

type Driver = { id: string; name: string };
type Order = { id: string; label: string; units: number; lat: number; lng: number };
type WeekOrder = { orderId: string; label: string; status: string };
type RouteStop = {
  id: string;
  orderId: string;
  label: string;
  sequenceNo: number;
  units: number;
  eta: string;
  lat: number;
  lng: number;
  status: 'ok' | 'warning' | 'conflict';
};
type RouteDay = {
  day: number;
  date: string;
  stops: RouteStop[];
  metrics: {
    km: number;
    durationMin: number;
    units: number;
    warnings: string[];
    conflicts: string[];
  };
};
type DriverRoutePlan = {
  driverId: string;
  driverName: string;
  color: string;
  externalRouteLink?: string;
  days: RouteDay[];
};
type AuditEntry = {
  id: string;
  actor: string;
  actionType: string;
  summary: string;
  createdAt: string;
};

type Week = {
  id: string;
  weekStartDate: string;
  status: 'draft' | 'archived';
  lockedAt: string | null;
  drivers: Array<{ driverId: string; driverName: string; workDaysCount: number }>;
  orders: WeekOrder[];
};

type OptimizerScenario = {
  id: string;
  name: string;
  description: string;
  precheck: { totalOrders: number; totalUnits: number; totalWorkDays: number };
};

type OptimizationResponse = {
  status: 'FEASIBLE' | 'PARTIAL' | 'INFEASIBLE';
  report: {
    precheck: {
      totalOrders: number;
      totalUnits: number;
      totalWorkDays: number;
      totalVehicleCapacityPerDay: number;
      totalWeeklyCapacity: number;
    };
    conflicts: Array<{ orderId?: string; code: string; reason: string }>;
    unassignedOrderIds: string[];
    objectiveBreakdown: { totalKm: number; totalDurationMin: number; totalFuelCost: number; score: number };
    notes: string[];
  };
};

type WeekDetails = Week & {
  availableDrivers: Driver[];
  availableOrders: Order[];
  previousWeekId: string | null;
  orderStatusCounts: Record<string, number>;
  routePlans: DriverRoutePlan[];
  auditLog: AuditEntry[];
  weeklyDiff: {
    current: { km: number; durationMin: number; units: number };
    baseline: { km: number; durationMin: number; units: number };
    delta: { km: number; durationMin: number; units: number };
    warnings: string[];
  };
  dayDiff: Array<{
    day: number;
    current: { km: number; durationMin: number; units: number };
    baseline: { km: number; durationMin: number; units: number };
    delta: { km: number; durationMin: number; units: number };
    warnings: string[];
  }>;
  mapMeta: { availableWeeks: Array<{ id: string; weekStartDate: string }> };
};

type DragPayload = {
  orderId: string;
  stopId: string;
  fromDriverId: string;
  fromDay: number;
};

export function PlanningPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>('');
  const [weekDetails, setWeekDetails] = useState<WeekDetails | null>(null);
  const [weekStartDate, setWeekStartDate] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [workDays, setWorkDays] = useState(5);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [transferOrders, setTransferOrders] = useState<string[]>([]);
  const [optimizerScenarios, setOptimizerScenarios] = useState<OptimizerScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'dispatcher' | 'map' | 'history'>('dispatcher');
  const [actorName, setActorName] = useState('Kierownik operacyjny');
  const [newStopOrderId, setNewStopOrderId] = useState('');
  const [newStopDriverId, setNewStopDriverId] = useState('');
  const [newStopDay, setNewStopDay] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'warning' | 'conflict'>('all');

  async function loadWeeks(preferredWeekId?: string) {
    const response = await fetch('/api/planning/weeks');
    const data: Week[] = await response.json();
    setWeeks(data);
    const effectiveWeekId = preferredWeekId ?? data[0]?.id;
    if (effectiveWeekId) {
      setSelectedWeekId(effectiveWeekId);
      await loadWeekDetails(effectiveWeekId);
    }
  }

  async function loadWeekDetails(weekId: string) {
    const response = await fetch(`/api/planning/weeks/${weekId}`);
    const details: WeekDetails = await response.json();
    setWeekDetails(details);
    setSelectedDriverId(details.availableDrivers[0]?.id ?? '');
    setSelectedOrders(details.orders.map((order) => order.orderId));
    setNewStopDriverId(details.routePlans[0]?.driverId ?? details.availableDrivers[0]?.id ?? '');
    setNewStopOrderId(details.availableOrders[0]?.id ?? '');
  }

  async function loadOptimizerScenarios() {
    const response = await fetch('/api/optimizer/scenarios');
    const scenarios: OptimizerScenario[] = await response.json();
    setOptimizerScenarios(scenarios);
    setSelectedScenarioId(scenarios[0]?.id ?? '');
  }

  useEffect(() => {
    void loadWeeks();
    void loadOptimizerScenarios();
  }, []);

  const previousWeekOrders = useMemo(() => {
    if (!weekDetails?.previousWeekId) return [];
    const previousWeek = weeks.find((week) => week.id === weekDetails.previousWeekId);
    return previousWeek?.orders ?? [];
  }, [weekDetails, weeks]);

  const filteredStops = useMemo(() => {
    if (!weekDetails) return [];
    return weekDetails.routePlans.flatMap((driver) =>
      driver.days.flatMap((day) =>
        day.stops
          .filter((stop) => statusFilter === 'all' || stop.status === statusFilter)
          .map((stop) => ({ driver, day, stop })),
      ),
    );
  }, [weekDetails, statusFilter]);

  async function handleCreateWeek(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch('/api/planning/weeks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStartDate }),
    });
    const created: Week = await response.json();
    await loadWeeks(created.id);
  }

  async function assignDriver() {
    if (!weekDetails || !selectedDriverId) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: selectedDriverId, workDaysCount: workDays }),
    });
    await loadWeeks(weekDetails.id);
  }

  async function updateWorkDays(driverId: string, days: number) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers/${driverId}/work-days`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workDaysCount: days }),
    });
    await loadWeekDetails(weekDetails.id);
  }

  async function unassignDriver(driverId: string) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/drivers/${driverId}`, { method: 'DELETE' });
    await loadWeeks(weekDetails.id);
  }

  async function saveOrderSelection() {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: selectedOrders }),
    });
    await loadWeeks(weekDetails.id);
  }

  async function updateOrderStatus(orderId: string, status: string) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await loadWeekDetails(weekDetails.id);
  }

  async function moveOrdersFromPreviousWeek() {
    if (!weekDetails || transferOrders.length === 0) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/orders/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: transferOrders }),
    });
    setTransferOrders([]);
    await loadWeeks(weekDetails.id);
  }

  async function runOptimizerScenario() {
    if (!selectedScenarioId) return;
    const scenarioResponse = await fetch(`/api/optimizer/scenarios/${selectedScenarioId}`);
    const scenario = await scenarioResponse.json();

    const response = await fetch('/api/optimizer/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario.input),
    });

    const result: OptimizationResponse = await response.json();
    setOptimizationResult(result);
  }

  async function archiveWeek() {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/archive`, { method: 'POST' });
    await loadWeeks(weekDetails.id);
  }

  async function applyManualEdit(payload: Record<string, unknown>) {
    if (!weekDetails) return;
    await fetch(`/api/planning/weeks/${weekDetails.id}/manual-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadWeekDetails(weekDetails.id);
  }

  function onStopDragStart(event: DragEvent<HTMLDivElement>, payload: DragPayload) {
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
  }

  function onDropToDay(event: DragEvent<HTMLElement>, toDriverId: string, toDay: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return;
    const payload = JSON.parse(raw) as DragPayload;

    if (payload.fromDriverId !== toDriverId) {
      void applyManualEdit({
        action: 'MOVE_ORDER',
        actor: actorName,
        orderId: payload.orderId,
        fromDriverId: payload.fromDriverId,
        fromDay: payload.fromDay,
        toDriverId,
        toDay,
      });
      return;
    }

    if (payload.fromDay !== toDay) {
      void applyManualEdit({
        action: 'MOVE_DAY',
        actor: actorName,
        orderId: payload.orderId,
        driverId: toDriverId,
        fromDay: payload.fromDay,
        toDay,
      });
    }
  }

  function onDropToStop(event: DragEvent<HTMLElement>, driverId: string, day: number, toSequence: number) {
    event.preventDefault();
    const raw = event.dataTransfer.getData('text/plain');
    if (!raw) return;
    const payload = JSON.parse(raw) as DragPayload;
    if (payload.fromDriverId === driverId && payload.fromDay === day) {
      void applyManualEdit({
        action: 'RESEQUENCE_STOP',
        actor: actorName,
        driverId,
        day,
        stopId: payload.stopId,
        toSequence,
      });
      return;
    }

    void applyManualEdit({
      action: 'MOVE_ORDER',
      actor: actorName,
      orderId: payload.orderId,
      fromDriverId: payload.fromDriverId,
      fromDay: payload.fromDay,
      toDriverId: driverId,
      toDay: day,
      toSequence,
    });
  }

  return (
    <section>
      <h1>Planowanie tygodniowe</h1>

      <form className="planning-create-form" onSubmit={handleCreateWeek}>
        <label>
          Data tygodnia
          <input type="date" value={weekStartDate} onChange={(event) => setWeekStartDate(event.target.value)} required />
        </label>
        <button type="submit">Utwórz tydzień</button>
      </form>

      <div className="planning-grid">
        <article>
          <h2>Lista tygodni</h2>
          <ul className="week-list">
            {weeks.map((week) => (
              <li key={week.id}>
                <button type="button" className={selectedWeekId === week.id ? 'active-week' : ''} onClick={() => void loadWeekDetails(week.id)}>
                  {week.weekStartDate} ({week.status})
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h2>Zespół i zamówienia tygodnia</h2>
          <div className="inline-controls">
            <select value={selectedDriverId} onChange={(event) => setSelectedDriverId(event.target.value)}>
              {weekDetails?.availableDrivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name}
                </option>
              ))}
            </select>
            <input type="number" min={1} max={7} value={workDays} onChange={(event) => setWorkDays(Number(event.target.value))} />
            <button type="button" onClick={() => void assignDriver()}>
              Dodaj / aktualizuj kierowcę
            </button>
            <button type="button" onClick={() => void archiveWeek()} disabled={weekDetails?.status === 'archived'}>
              Archiwizuj tydzień
            </button>
          </div>

          <div className="optimizer-panel">
            <h3>Silnik układania tras (VRP)</h3>
            <div className="inline-controls">
              <select value={selectedScenarioId} onChange={(event) => setSelectedScenarioId(event.target.value)}>
                {optimizerScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => void runOptimizerScenario()} disabled={!selectedScenarioId}>
                Uruchom optymalizację
              </button>
            </div>
            {optimizationResult && (
              <p>
                Wynik {optimizationResult.status}: {optimizationResult.report.objectiveBreakdown.totalKm} km, {optimizationResult.report.objectiveBreakdown.totalDurationMin} min.
              </p>
            )}
          </div>

          <h3>Kierowcy w tygodniu</h3>
          <ul>
            {weekDetails?.drivers.map((driver) => (
              <li key={driver.driverId}>
                {driver.driverName} ({driver.workDaysCount} dni)
                <button type="button" onClick={() => void updateWorkDays(driver.driverId, Math.min(7, driver.workDaysCount + 1))}>
                  +1 dzień
                </button>
                <button type="button" onClick={() => void unassignDriver(driver.driverId)}>
                  Usuń
                </button>
              </li>
            ))}
          </ul>

          <h3>Zamówienia tygodnia</h3>
          <div className="inline-controls">
            <button type="button" onClick={() => void saveOrderSelection()}>
              Zapisz wybór zamówień
            </button>
            <button type="button" onClick={() => void moveOrdersFromPreviousWeek()} disabled={transferOrders.length === 0}>
              Przenieś z poprzedniego tygodnia
            </button>
          </div>
          <div className="order-picker-grid">
            {weekDetails?.availableOrders.map((order) => (
              <label key={order.id} className="order-box">
                <input
                  type="checkbox"
                  checked={selectedOrders.includes(order.id)}
                  onChange={(event) => {
                    setSelectedOrders((prev) => (event.target.checked ? [...prev, order.id] : prev.filter((id) => id !== order.id)));
                  }}
                />
                {order.label}
              </label>
            ))}
          </div>
          <div className="order-picker-grid">
            {weekDetails?.orders.map((order) => (
              <label key={order.orderId} className="order-box">
                <strong>{order.label}</strong>
                <select value={order.status} onChange={(event) => void updateOrderStatus(order.orderId, event.target.value)}>
                  <option value="unassigned">unassigned</option>
                  <option value="planned">planned</option>
                  <option value="conflict">conflict</option>
                  <option value="moved">moved</option>
                  <option value="skipped">skipped</option>
                </select>
                {previousWeekOrders.some((item) => item.orderId === order.orderId) && (
                  <input
                    type="checkbox"
                    checked={transferOrders.includes(order.orderId)}
                    onChange={(event) => {
                      setTransferOrders((prev) =>
                        event.target.checked ? [...prev, order.orderId] : prev.filter((id) => id !== order.orderId),
                      );
                    }}
                  />
                )}
              </label>
            ))}
          </div>

          <h2>Ręczna dyspozytornia</h2>
          <div className="inline-controls">
            <button type="button" onClick={() => setActiveTab('dispatcher')} className={activeTab === 'dispatcher' ? 'tab-active' : ''}>
              Edycja tras
            </button>
            <button type="button" onClick={() => setActiveTab('map')} className={activeTab === 'map' ? 'tab-active' : ''}>
              Mapa tygodnia
            </button>
            <button type="button" onClick={() => setActiveTab('history')} className={activeTab === 'history' ? 'tab-active' : ''}>
              Historia i porównanie
            </button>
            <input value={actorName} onChange={(event) => setActorName(event.target.value)} placeholder="Kto edytuje" />
          </div>

          {weekDetails && activeTab === 'dispatcher' && (
            <div>
              <div className="diff-card">
                <strong>Tydzień: różnica do planu auto</strong>
                <p>
                  km Δ {weekDetails.weeklyDiff.delta.km}, min Δ {weekDetails.weeklyDiff.delta.durationMin}, jednostki Δ {weekDetails.weeklyDiff.delta.units}
                </p>
                {weekDetails.weeklyDiff.warnings.length > 0 && <p className="error">Ostrzeżenia: {weekDetails.weeklyDiff.warnings.join(' | ')}</p>}
              </div>

              <div className="inline-controls">
                <select value={newStopOrderId} onChange={(event) => setNewStopOrderId(event.target.value)}>
                  {weekDetails.availableOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.label}
                    </option>
                  ))}
                </select>
                <select value={newStopDriverId} onChange={(event) => setNewStopDriverId(event.target.value)}>
                  {weekDetails.routePlans.map((driver) => (
                    <option key={driver.driverId} value={driver.driverId}>
                      {driver.driverName}
                    </option>
                  ))}
                </select>
                <input type="number" min={1} max={7} value={newStopDay} onChange={(event) => setNewStopDay(Number(event.target.value))} />
                <button
                  type="button"
                  onClick={() =>
                    void applyManualEdit({ action: 'ADD_STOP', actor: actorName, driverId: newStopDriverId, day: newStopDay, orderId: newStopOrderId })
                  }
                >
                  Dodaj stop
                </button>
              </div>

              {weekDetails.routePlans.map((driver) => (
                <section key={driver.driverId} className="driver-board">
                  <header className="driver-head" style={{ borderLeftColor: driver.color }}>
                    <h3>{driver.driverName}</h3>
                    <input
                      value={driver.externalRouteLink ?? ''}
                      placeholder="https://zewnetrzny-link-trasy"
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (!value) return;
                        void applyManualEdit({
                          action: 'UPDATE_EXTERNAL_LINK',
                          actor: actorName,
                          driverId: driver.driverId,
                          externalRouteLink: value,
                        });
                      }}
                    />
                    {driver.externalRouteLink && (
                      <a href={driver.externalRouteLink} target="_blank" rel="noreferrer">
                        Otwórz link zewnętrzny
                      </a>
                    )}
                  </header>
                  <div className="day-grid">
                    {driver.days.map((day) => (
                      <article
                        key={`${driver.driverId}-${day.day}`}
                        className="day-column"
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => onDropToDay(event, driver.driverId, day.day)}
                      >
                        <h4>
                          Dzień {day.day} ({day.date})
                        </h4>
                        <small>
                          {day.metrics.km} km · {day.metrics.durationMin} min · {day.metrics.units} j.
                        </small>
                        {day.metrics.warnings.concat(day.metrics.conflicts).map((warning, idx) => (
                          <p key={idx} className="error">
                            {warning}
                          </p>
                        ))}
                        <div>
                          {day.stops.map((stop) => (
                            <div
                              key={stop.id}
                              draggable
                              className={`stop-card stop-${stop.status}`}
                              onDragStart={(event) => onStopDragStart(event, { orderId: stop.orderId, stopId: stop.id, fromDriverId: driver.driverId, fromDay: day.day })}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => onDropToStop(event, driver.driverId, day.day, stop.sequenceNo)}
                            >
                              <strong>
                                #{stop.sequenceNo} {stop.label}
                              </strong>
                              <small>
                                ETA {stop.eta} · {stop.units} j.
                              </small>
                              <div className="inline-controls">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void applyManualEdit({
                                      action: 'RESEQUENCE_STOP',
                                      actor: actorName,
                                      driverId: driver.driverId,
                                      day: day.day,
                                      stopId: stop.id,
                                      toSequence: Math.max(1, stop.sequenceNo - 1),
                                    })
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void applyManualEdit({
                                      action: 'RESEQUENCE_STOP',
                                      actor: actorName,
                                      driverId: driver.driverId,
                                      day: day.day,
                                      stopId: stop.id,
                                      toSequence: stop.sequenceNo + 1,
                                    })
                                  }
                                >
                                  ↓
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void applyManualEdit({
                                      action: 'REMOVE_STOP',
                                      actor: actorName,
                                      driverId: driver.driverId,
                                      day: day.day,
                                      stopId: stop.id,
                                    })
                                  }
                                >
                                  Usuń
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {weekDetails && activeTab === 'map' && (
            <section>
              <div className="inline-controls">
                <label>
                  Filtr statusu
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    <option value="all">Wszystkie</option>
                    <option value="ok">OK</option>
                    <option value="warning">Warning</option>
                    <option value="conflict">Conflict</option>
                  </select>
                </label>
              </div>
              <div className="map-canvas">
                {filteredStops.map(({ driver, day, stop }) => (
                  <button key={stop.id} className="map-point" style={{ left: `${15 + stop.lng % 20}%`, top: `${15 + stop.lat % 60}%`, borderColor: driver.color }}>
                    {day.day}
                    <span className="map-popup">
                      <strong>{stop.label}</strong>
                      <br />
                      Kierowca: {driver.driverName}
                      <br />
                      Dzień: {day.day}
                      <br />
                      Status: {stop.status}
                    </span>
                  </button>
                ))}
              </div>
              <p>Kolory reprezentują kierowców, numer przy punkcie to dzień trasy. Punkty i polilinie są uproszczone do widoku operacyjnego.</p>
            </section>
          )}

          {weekDetails && activeTab === 'history' && (
            <section>
              <h3>Historia zmian ręcznych (pełny audyt)</h3>
              <ul className="audit-list">
                {weekDetails.auditLog.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.actor}</strong> [{entry.actionType}] {entry.summary} <small>{new Date(entry.createdAt).toLocaleString()}</small>
                  </li>
                ))}
              </ul>

              <h3>Porównanie tygodni</h3>
              <div className="inline-controls">
                <label>
                  Tydzień do podglądu
                  <select value={selectedWeekId} onChange={(event) => void loadWeekDetails(event.target.value)}>
                    {weekDetails.mapMeta.availableWeeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        {week.weekStartDate}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Dzień</th>
                    <th>Aktualny km</th>
                    <th>Auto km</th>
                    <th>Delta km</th>
                    <th>Ostrzeżenia</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDetails.dayDiff.map((diff) => (
                    <tr key={diff.day}>
                      <td>{diff.day}</td>
                      <td>{diff.current.km}</td>
                      <td>{diff.baseline.km}</td>
                      <td>{diff.delta.km}</td>
                      <td>{diff.warnings.join(', ') || 'brak'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </article>
      </div>
    </section>
  );
}
