import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Plus,
  House as HouseIcon,
  Users,
  RefreshCw,
  X,
  Pencil,
  Trash2,
  Save,
} from "lucide-react";
import {
  getHouses,
  createHouse,
  getTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getErrorMessage,
} from "../lib/api";
import type { House, Tenant, User, UpdateTenantData } from "../types";

function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 text-sm ${
        error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {message}
    </div>
  );
}

function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function HousesPage({ user }: { user: User }) {
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [houseNumber, setHouseNumber] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const canManage = user.role === "caretaker";

  async function loadHouses() {
    setLoading(true);
    setError("");

    try {
      setHouses(await getHouses());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHouses();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await createHouse({
        house_number: houseNumber.trim(),
        description: description.trim(),
      });

      setHouseNumber("");
      setDescription("");
      setShowForm(false);
      setMessage("House added successfully.");
      await loadHouses();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const occupied = houses.filter(
    (house) => house.status?.toLowerCase() === "occupied",
  ).length;

  return (
    <div>
      <PageHeader
        title="Houses"
        description="Manage your property's housing units and occupancy."
        action={
          canManage ? (
            <button
              onClick={() => setShowForm(!showForm)}
              className="primary-button flex items-center gap-2"
            >
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "Close" : "Add house"}
            </button>
          ) : undefined
        }
      />

      {message && <Notice message={message} />}
      {error && <Notice message={error} error />}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <p className="text-sm text-slate-500">Total houses</p>
          <p className="mt-2 text-3xl font-semibold">{houses.length}</p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">Occupied</p>
          <p className="mt-2 text-3xl font-semibold">{occupied}</p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">Vacant</p>
          <p className="mt-2 text-3xl font-semibold">
            {houses.length - occupied}
          </p>
        </div>
      </div>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="panel mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Register a house</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">
              House number
            </label>
            <input
              className="input-field"
              value={houseNumber}
              onChange={(event) => setHouseNumber(event.target.value)}
              placeholder="e.g. A-01"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Description
            </label>
            <input
              className="input-field"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional description"
            />
          </div>

          <button className="primary-button" disabled={saving}>
            {saving ? "Saving..." : "Save house"}
          </button>
        </form>
      )}

      <div className="panel">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">All houses</h2>
            <p className="text-sm text-slate-500">
              Your registered housing units
            </p>
          </div>
          <button
            onClick={() => void loadHouses()}
            className="secondary-button flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Loading houses...
          </p>
        ) : houses.length === 0 ? (
          <div className="py-12 text-center">
            <HouseIcon className="mx-auto mb-3 text-slate-300" size={34} />
            <p className="font-medium text-slate-700">
              No houses registered yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add your first house to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">House</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {houses.map((house) => {
                  const isOccupied = house.status?.toLowerCase() === "occupied";

                  return (
                    <tr key={house.id}>
                      <td className="py-4 font-medium text-slate-800">
                        {house.house_number}
                      </td>
                      <td className="py-4 text-slate-500">
                        {house.description || "No description"}
                      </td>
                      <td className="py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isOccupied
                              ? "bg-blue-50 text-blue-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {house.status || "Unknown"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function TenantsPage({ user }: { user: User }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [houseId, setHouseId] = useState("");
  const [password, setPassword] = useState("");

  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editHouseId, setEditHouseId] = useState("");

  const canManage = user.role === "caretaker";

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [tenantData, houseData] = await Promise.all([
        getTenants(),
        getHouses(),
      ]);
      setTenants(tenantData);
      setHouses(houseData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetCreateForm() {
    setFullName("");
    setEmail("");
    setPhone("");
    setHouseId("");
    setPassword("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await createTenant({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        house_id: Number(houseId),
        password,
      });

      resetCreateForm();
      setShowForm(false);
      setMessage("Tenant account created and house assigned.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(tenant: Tenant) {
    setEditingTenant(tenant);
    setEditFullName(tenant.full_name);
    setEditEmail(tenant.email);
    setEditPhone(tenant.phone || "");
    setEditHouseId(String(tenant.house_id));
    setShowForm(false);
    setMessage("");
    setError("");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTenant) return;

    setSaving(true);
    setMessage("");
    setError("");

    const data: UpdateTenantData = {
      full_name: editFullName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      house_id: Number(editHouseId),
    };

    try {
      await updateTenant(editingTenant.id, data);
      setEditingTenant(null);
      setMessage("Tenant details and house assignment updated.");
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(tenant: Tenant) {
    const confirmed = window.confirm(
      `Permanently delete ${tenant.full_name} and their account?\n\n` +
        `Their requests, feedback and leaving notices will also be deleted. ` +
        `House ${tenant.house_number} will remain and become vacant.\n\n` +
        `This action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(tenant.id);
    setMessage("");
    setError("");

    try {
      await deleteTenant(tenant.id);
      setMessage(
        `${tenant.full_name} has been permanently deleted. ` +
          `House ${tenant.house_number} is now available.`,
      );
      if (editingTenant?.id === tenant.id) {
        setEditingTenant(null);
      }
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  const vacantHouses = houses.filter(
    (house) =>
      house.status?.toLowerCase() !== "occupied" ||
      house.id === editingTenant?.house_id,
  );

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Manage tenant accounts, personal details and house assignments."
        action={
          canManage ? (
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditingTenant(null);
                setMessage("");
                setError("");
              }}
              className="primary-button flex items-center gap-2"
            >
              {showForm ? <X size={17} /> : <Plus size={17} />}
              {showForm ? "Close" : "Add tenant"}
            </button>
          ) : undefined
        }
      />

      {message && <Notice message={message} />}
      {error && <Notice message={error} error />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="panel">
          <p className="text-sm text-slate-500">Active tenants</p>
          <p className="mt-2 text-3xl font-semibold">
            {tenants.filter((tenant) => tenant.is_active).length}
          </p>
        </div>
        <div className="panel">
          <p className="text-sm text-slate-500">Available houses</p>
          <p className="mt-2 text-3xl font-semibold">
            {
              houses.filter(
                (house) => house.status?.toLowerCase() !== "occupied",
              ).length
            }
          </p>
        </div>
      </div>

      {showForm && canManage && (
        <form onSubmit={handleCreate} className="panel mb-6 space-y-4">
          <h2 className="font-semibold text-slate-900">
            Create tenant account
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Full name
              </label>
              <input
                className="input-field"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tenant's full name"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="input-field"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tenant@example.com"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                className="input-field"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="07..."
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Assign house
              </label>
              <select
                className="input-field"
                value={houseId}
                onChange={(event) => setHouseId(event.target.value)}
                required
              >
                <option value="">Select a vacant house</option>
                {houses
                  .filter((house) => house.status?.toLowerCase() !== "occupied")
                  .map((house) => (
                    <option key={house.id} value={house.id}>
                      {house.house_number}
                    </option>
                  ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">
                Initial password
              </label>
              <input
                className="input-field"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
          </div>

          <button
            className="primary-button"
            disabled={
              saving ||
              houses.every(
                (house) => house.status?.toLowerCase() === "occupied",
              )
            }
          >
            {saving ? "Creating..." : "Create tenant"}
          </button>

          {houses.every(
            (house) => house.status?.toLowerCase() === "occupied",
          ) && (
            <p className="text-sm text-amber-700">
              There are no vacant houses available for assignment.
            </p>
          )}
        </form>
      )}

      {editingTenant && canManage && (
        <form onSubmit={handleUpdate} className="panel mb-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Edit tenant</h2>
              <p className="text-sm text-slate-500">
                Update details or move this tenant to another vacant house.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditingTenant(null)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              aria-label="Close edit form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Full name
              </label>
              <input
                className="input-field"
                value={editFullName}
                onChange={(event) => setEditFullName(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="input-field"
                type="email"
                value={editEmail}
                onChange={(event) => setEditEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                className="input-field"
                value={editPhone}
                onChange={(event) => setEditPhone(event.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Assigned house
              </label>
              <select
                className="input-field"
                value={editHouseId}
                onChange={(event) => setEditHouseId(event.target.value)}
                required
              >
                {vacantHouses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.house_number}
                    {house.id === editingTenant.house_id ? " (Current)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="primary-button flex items-center gap-2"
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setEditingTenant(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="panel">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">Tenant directory</h2>
            <p className="text-sm text-slate-500">
              Current tenant accounts and house assignments
            </p>
          </div>
          <button
            onClick={() => void loadData()}
            className="secondary-button flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Loading tenants...
          </p>
        ) : tenants.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 text-slate-300" size={34} />
            <p className="font-medium text-slate-700">
              No tenants registered yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Tenant accounts created by the caretaker will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <tr>
                  <th className="pb-3 font-medium">Tenant</th>
                  <th className="pb-3 font-medium">Contact</th>
                  <th className="pb-3 font-medium">House</th>
                  <th className="pb-3 font-medium">Status</th>
                  {canManage && <th className="pb-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="py-4 font-medium text-slate-800">
                      {tenant.full_name}
                    </td>
                    <td className="py-4 text-slate-500">
                      <div>{tenant.email}</div>
                      <div>{tenant.phone || "No phone"}</div>
                    </td>
                    <td className="py-4 text-slate-600">
                      {tenant.house_number}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          tenant.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tenant.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => beginEdit(tenant)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-950"
                            title="Edit tenant"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => void handleDelete(tenant)}
                            disabled={deletingId === tenant.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
                            title="Permanently delete tenant"
                          >
                            <Trash2 size={14} />
                            {deletingId === tenant.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
