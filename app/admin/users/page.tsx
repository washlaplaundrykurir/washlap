"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

interface User {
  id: string;
  email: string;
  role: string;
  full_name: string | null;
}

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "super-admin", label: "Super Admin" },
  { value: "kurir", label: "Kurir" },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  // Modal states
  const createModal = useDisclosure();
  const editModal = useDisclosure();
  const deleteModal = useDisclosure();

  // Form states
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    role: "",
    full_name: "",
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/users");
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setUsers(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching users");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.email?.trim() || !formData.role) {
      showToast("error", "Email dan Role wajib diisi!");

      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      createModal.onClose();
      resetForm();
      fetchUsers();
      showToast("success", "User berhasil ditambahkan!");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error creating user",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    if (!formData.email?.trim() || !formData.role) {
      showToast("error", "Email dan Role wajib diisi!");

      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedUser.id,
          role: formData.role,
          full_name: formData.full_name,
          password: formData.password, // Send password if provided
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      editModal.onClose();
      resetForm();
      fetchUsers();
      showToast("success", "User berhasil diupdate!");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error updating user",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/users?id=${selectedUser.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      deleteModal.onClose();
      setSelectedUser(null);
      fetchUsers();
      showToast("success", "User berhasil dihapus!");
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Error deleting user",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      email: user.email,
      password: "",
      role: user.role,
      full_name: user.full_name || "",
    });
    editModal.onOpen();
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    deleteModal.onOpen();
  };

  const resetForm = () => {
    setFormData({ email: "", password: "", role: "", full_name: "" });
    setSelectedUser(null);
    setError("");
  };

  const roleColor = (
    role: string,
  ): "success" | "primary" | "default" | "secondary" => {
    switch (role) {
      case "admin":
        return "success";
      case "super-admin":
        return "secondary";
      case "kurir":
        return "primary";
      default:
        return "default";
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Kelola User
          </h1>
          <p className="text-gray-600 dark:text-white/70">
            Total: {users.length} user
          </p>
        </div>
        <Button
          color="primary"
          onClick={() => {
            resetForm();
            createModal.onOpen();
          }}
        >
          + Tambah User
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="mb-4 bg-red-500/20 border border-red-500/30">
          <CardBody className="text-red-600 dark:text-red-400 text-sm">
            {error}
            <Button
              className="ml-2"
              size="sm"
              variant="light"
              onClick={() => setError("")}
            >
              <X size={16} />
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Users Table */}
      {!isLoading && (
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Daftar User
            </h2>
          </CardHeader>
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-white/20">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-white/70">
                      Nama
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-white/70">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-white/70">
                      Role
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-white/70">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td
                        className="py-8 text-center text-gray-500 dark:text-white/50"
                        colSpan={4}
                      >
                        Belum ada user
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr
                        key={user.id}
                        className="border-b border-gray-100 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5"
                      >
                        <td className="py-3 px-4 text-gray-900 dark:text-white">
                          {user.full_name || "-"}
                        </td>
                        <td className="py-3 px-4 text-gray-600 dark:text-white/70">
                          {user.email}
                        </td>
                        <td className="py-3 px-4">
                          <Chip
                            color={roleColor(user.role)}
                            size="sm"
                            variant="flat"
                          >
                            {user.role.toUpperCase()}
                          </Chip>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            className="mr-2"
                            size="sm"
                            variant="light"
                            onClick={() => openEditModal(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            color="danger"
                            size="sm"
                            variant="light"
                            onClick={() => openDeleteModal(user)}
                          >
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
      {/* Create Modal */}
      <Modal isOpen={createModal.isOpen} onClose={createModal.onClose}>
        <ModalContent className="bg-white dark:bg-gray-900">
          <ModalHeader>Tambah User Baru</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input
                label="Nama Lengkap (Opsional)"
                value={formData.full_name}
                onValueChange={(v) =>
                  setFormData({ ...formData, full_name: v })
                }
              />
              <Input
                label="Email"
                type="email"
                value={formData.email}
                onValueChange={(v) => setFormData({ ...formData, email: v })}
              />
              <Input
                label="Password (Opsional)"
                placeholder="Default: 12345678"
                type="password"
                value={formData.password}
                onValueChange={(v) => setFormData({ ...formData, password: v })}
              />
              <Select
                label="Role"
                selectedKeys={formData.role ? [formData.role] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;

                  setFormData({ ...formData, role: val });
                }}
              >
                {roleOptions.map((r) => (
                  <SelectItem key={r.value}>{r.label}</SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={createModal.onClose}>
              Batal
            </Button>
            <Button
              color="primary"
              isLoading={actionLoading}
              onClick={handleCreate}
            >
              Simpan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose}>
        <ModalContent className="bg-white dark:bg-gray-900">
          <ModalHeader>Edit User</ModalHeader>
          <ModalBody>
            <div className="flex flex-col gap-4">
              <Input isDisabled label="Email" value={formData.email} />

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-600 dark:text-blue-300">
                Isi password hanya jika ingin mereset password user ini.
              </div>
              <Input
                label="Reset Password"
                placeholder="Masukkan password baru (opsional)"
                type="password"
                value={formData.password}
                onValueChange={(v) => setFormData({ ...formData, password: v })}
              />

              <Input
                label="Nama Lengkap"
                value={formData.full_name}
                onValueChange={(v) =>
                  setFormData({ ...formData, full_name: v })
                }
              />
              <Select
                label="Role"
                selectedKeys={formData.role ? [formData.role] : []}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;

                  setFormData({ ...formData, role: val });
                }}
              >
                {roleOptions.map((r) => (
                  <SelectItem key={r.value}>{r.label}</SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={editModal.onClose}>
              Batal
            </Button>
            <Button
              color="primary"
              isLoading={actionLoading}
              onClick={handleUpdate}
            >
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent className="bg-white dark:bg-gray-900">
          <ModalHeader>Hapus User</ModalHeader>
          <ModalBody>
            <p className="text-gray-600 dark:text-white/70">
              Apakah Anda yakin ingin menghapus user{" "}
              <strong>{selectedUser?.email}</strong>?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={deleteModal.onClose}>
              Batal
            </Button>
            <Button
              color="danger"
              isLoading={actionLoading}
              onClick={handleDelete}
            >
              Hapus
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
