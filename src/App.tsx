import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, 
  Skull,
  Calendar as CalendarIcon, 
  Clock, 
  User as UserIcon, 
  ChevronRight, 
  CheckCircle2, 
  LogOut, 
  Menu, 
  X,
  Plus,
  Trash2,
  Settings,
  LayoutDashboard,
  Users,
  TrendingUp,
  DollarSign,
  Phone,
  Search,
  Filter,
  ArrowRight,
  LogIn,
  Package,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  History
} from 'lucide-react';
import { 
  format, 
  addDays, 
  isSameDay, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isWithinInterval,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  addMinutes
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { cn } from './lib/utils';
import { User, Service, Appointment, Product, StockMovement } from './types';

// Error Handling Spec for Firestore Operations
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // Surface to UI or throw
  return errInfo;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'agenda' | 'services' | 'staff' | 'reports' | 'stock'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Auth UI State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const nameRef = useRef('');
  useEffect(() => { nameRef.current = name; }, [name]);
  const [authError, setAuthError] = useState<string | null>(null);

  // Data State
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  // UI State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditStaffModalOpen, setIsEditStaffModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isStockMovementModalOpen, setIsStockMovementModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [selectedAptForCheckout, setSelectedAptForCheckout] = useState<Appointment | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [reportRange, setReportRange] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportBarberFilter, setReportBarberFilter] = useState<string>('all');
  const [reportServiceFilter, setReportServiceFilter] = useState<string>('all');
  const [reportTimeFilter, setReportTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');
  const [agendaDate, setAgendaDate] = useState(new Date());

  // Service Form State
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    duration: '30'
  });

  // Invite Form State
  const [newInvite, setNewInvite] = useState({
    name: '',
    email: '',
    role: 'employee' as 'owner' | 'employee',
    permissions: 'standard' as 'master' | 'standard'
  });

  // Product Form State
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    minStock: '5',
    unit: 'un'
  });

  // Stock Movement Form State
  const [newMovement, setNewMovement] = useState({
    type: 'in' as 'in' | 'out',
    quantity: '',
    reason: ''
  });

  // Booking Form State
  const [newApt, setNewApt] = useState({
    clientName: '',
    clientPhone: '',
    barberId: '',
    serviceId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00'
  });

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isBootstrapAdmin = firebaseUser.email === 'yvamaral22@gmail.com' || firebaseUser.email === 'ygorvi110@gmail.com';
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            // Check for invitation
            const inviteQuery = query(collection(db, 'staff_invites'), where('email', '==', firebaseUser.email));
            const inviteSnapshot = await getDoc(doc(db, 'staff_invites', firebaseUser.email || 'none'));
            
            let role: 'owner' | 'employee' = isBootstrapAdmin ? 'owner' : 'employee';
            let permissions: 'master' | 'standard' = isBootstrapAdmin ? 'master' : 'standard';
            let invitedName: string = firebaseUser.displayName || nameRef.current || 'Novo Barbeiro';

            if (inviteSnapshot.exists()) {
              const inviteData = inviteSnapshot.data();
              role = inviteData.role || role;
              permissions = inviteData.permissions || permissions;
              invitedName = inviteData.name || invitedName;
              // Delete invite after use
              await deleteDoc(doc(db, 'staff_invites', firebaseUser.email!));
            }

            const userData: User = {
              uid: firebaseUser.uid,
              name: invitedName,
              email: firebaseUser.email || '',
              role,
              permissions,
              createdAt: new Date().toISOString()
            };
            
            await setDoc(userDocRef, userData);
            await setDoc(doc(db, 'profiles', firebaseUser.uid), {
              uid: userData.uid,
              name: userData.name || 'Novo Barbeiro',
              role: userData.role
            });
            setUser(userData);
          } else {
            const userData = { ...userDoc.data(), uid: firebaseUser.uid } as User;
            if (!userData.name) userData.name = firebaseUser.displayName || 'Usuário';
            
            // Auto-upgrade bootstrap admins if they are not master
            if (isBootstrapAdmin && userData.permissions !== 'master') {
              userData.permissions = 'master';
              userData.role = 'owner';
              await setDoc(userDocRef, userData, { merge: true });
            }
            
            setUser(userData);
            
            // Sync profile if missing
            const profileDoc = await getDoc(doc(db, 'profiles', firebaseUser.uid));
            if (!profileDoc.exists()) {
              await setDoc(doc(db, 'profiles', firebaseUser.uid), {
                uid: userData.uid,
                name: userData.name || 'Usuário',
                role: userData.role
              });
            }
          }
        } catch (err: any) {
          // If permission denied but we have a firebaseUser, 
          // it might be a new user or rule propagation delay.
          // We'll set a temporary local state so the app doesn't crash.
          if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
            const fallbackUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || nameRef.current || 'Usuário',
              email: firebaseUser.email || '',
              role: isBootstrapAdmin ? 'owner' : 'employee',
              permissions: isBootstrapAdmin ? 'master' : 'standard',
              createdAt: new Date().toISOString()
            };
            setUser(fallbackUser);
          } else {
            handleFirestoreError(err, OperationType.GET, 'users');
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    // Connection Test
    const testConnection = async () => {
      try {
        const testDocRef = doc(db, 'system', 'connection_test');
        await getDoc(testDocRef);
      } catch (error: any) {
        if (error.message?.includes('client is offline') || error.code === 'unavailable') {
          toast.error("Erro de conexão com o banco de dados. Verifique sua internet.");
        }
      }
    };
    testConnection();

    // Services Listener
    const servicesUnsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const servicesData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Service))
        .filter(s => !s.deleted);
      setServices(servicesData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.warn("Sem permissão para listar serviços. Verifique as regras do Firestore.");
      } else {
        handleFirestoreError(err, OperationType.LIST, 'services');
      }
    });

    // Staff Listener
    const staffCollection = user.permissions === 'master' ? 'users' : 'profiles';
    const staffUnsubscribe = onSnapshot(collection(db, staffCollection), (snapshot) => {
      const staffData = snapshot.docs
        .map(doc => doc.data() as User)
        .filter(s => !s.deleted);
      setStaff(staffData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.warn(`Sem permissão para listar ${staffCollection}.`);
      } else {
        handleFirestoreError(err, OperationType.LIST, staffCollection);
      }
    });

    // Appointments Listener
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = user.permissions === 'master' 
      ? query(appointmentsRef, orderBy('date', 'asc'))
      : query(appointmentsRef, where('barberId', '==', user.uid));

    const appointmentsUnsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
      const appointmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      // Sort client-side for non-masters to avoid composite index requirement
      if (user.permissions !== 'master') {
        appointmentsData.sort((a, b) => a.date.localeCompare(b.date));
      }
      setAppointments(appointmentsData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.warn("Sem permissão para listar agendamentos.");
      } else {
        handleFirestoreError(err, OperationType.LIST, 'appointments');
      }
    });

    // Products Listener
    const productsUnsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const productsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Product))
        .filter(p => !p.deleted);
      setProducts(productsData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.warn("Sem permissão para listar produtos.");
      } else {
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    });

    // Stock Movements Listener
    const movementsUnsubscribe = onSnapshot(query(collection(db, 'stock_movements'), orderBy('date', 'desc')), (snapshot) => {
      const movementsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockMovement));
      setStockMovements(movementsData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.warn("Sem permissão para listar movimentações de estoque.");
      } else {
        handleFirestoreError(err, OperationType.LIST, 'stock_movements');
      }
    });

    return () => {
      servicesUnsubscribe();
      staffUnsubscribe();
      appointmentsUnsubscribe();
      productsUnsubscribe();
      movementsUnsubscribe();
    };
  }, [user]);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Por favor, digite seu e-mail primeiro.');
      return;
    }

    const promise = sendPasswordResetEmail(auth, email);
    toast.promise(promise, {
      loading: 'Enviando e-mail de redefinição...',
      success: 'E-mail enviado! Verifique sua caixa de entrada.',
      error: (err) => {
        if (err.code === 'auth/user-not-found') return 'Usuário não encontrado.';
        if (err.code === 'auth/invalid-email') return 'E-mail inválido.';
        return 'Erro ao enviar e-mail.';
      }
    });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (authMode === 'register') {
      if (password !== confirmPassword) {
        setAuthError('As senhas não coincidem.');
        return;
      }
      if (password.length < 6) {
        setAuthError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: name });
        }
      } catch (err: any) {
        setAuthError(err.message);
      }
    } else {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err: any) {
        setAuthError('E-mail ou senha incorretos.');
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsMenuOpen(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const selectedService = services.find(s => s.id === newApt.serviceId);
    const selectedBarber = staff.find(s => s.uid === newApt.barberId);

    if (!selectedService || !selectedBarber) return;

    // Conflict Prevention
    const newStart = parseISO(`${newApt.date}T${newApt.time}`);
    const newEnd = addMinutes(newStart, selectedService.duration);

    const conflict = appointments.find(apt => {
      if (apt.barberId !== selectedBarber.uid || apt.status === 'cancelled') return false;
      
      const aptStart = parseISO(apt.date);
      const duration = apt.duration || 30;
      const aptEnd = addMinutes(aptStart, duration);

      return (newStart < aptEnd && newEnd > aptStart);
    });

    if (conflict) {
      toast.error(`Conflito de horário! ${selectedBarber.name} já tem um agendamento das ${format(parseISO(conflict.date), 'HH:mm')} até as ${format(addMinutes(parseISO(conflict.date), conflict.duration || 30), 'HH:mm')}.`);
      return;
    }

    const promise = (async () => {
      const appointmentData = {
        clientName: newApt.clientName,
        clientPhone: newApt.clientPhone,
        barberId: selectedBarber.uid,
        barberName: selectedBarber.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        duration: selectedService.duration,
        date: `${newApt.date}T${newApt.time}`,
        status: 'confirmed',
        paymentMethod: null,
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'appointments'), appointmentData);
      setIsBookingModalOpen(false);
      setNewApt({ ...newApt, clientName: '', clientPhone: '' });
    })();

    toast.promise(promise, {
      loading: 'Agendando...',
      success: 'Agendamento realizado com sucesso!',
      error: 'Erro ao agendar. Tente novamente.'
    });
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManageAll) return;

    const promise = (async () => {
      const serviceData = {
        name: newService.name,
        description: newService.description,
        price: parseFloat(newService.price),
        duration: parseInt(newService.duration),
      };

      await addDoc(collection(db, 'services'), serviceData);
      setIsServiceModalOpen(false);
      setNewService({ name: '', description: '', price: '', duration: '30' });
    })();

    toast.promise(promise, {
      loading: 'Salvando serviço...',
      success: 'Serviço adicionado com sucesso!',
      error: 'Erro ao salvar serviço.'
    });
  };

  const handleDeleteAppointment = async (id: string) => {
    const promise = deleteDoc(doc(db, 'appointments', id));
    toast.promise(promise, {
      loading: 'Cancelando agendamento...',
      success: 'Agendamento cancelado.',
      error: 'Erro ao cancelar.'
    });
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !canManageAll) return;

    const promise = (async () => {
      const serviceData = {
        name: editingService.name,
        description: editingService.description,
        price: typeof editingService.price === 'string' ? parseFloat(editingService.price) : editingService.price,
        duration: typeof editingService.duration === 'string' ? parseInt(editingService.duration) : editingService.duration,
      };

      await updateDoc(doc(db, 'services', editingService.id), serviceData);
      setEditingService(null);
    })();

    toast.promise(promise, {
      loading: 'Atualizando serviço...',
      success: 'Serviço atualizado com sucesso!',
      error: 'Erro ao atualizar serviço.'
    });
  };

  const handleDeleteService = async (id: string) => {
    if (!canManageAll) return;
    if (!window.confirm('Tem certeza que deseja remover este serviço?')) return;

    const promise = updateDoc(doc(db, 'services', id), { deleted: true });
    toast.promise(promise, {
      loading: 'Removendo serviço...',
      success: 'Serviço removido.',
      error: 'Erro ao remover.'
    });
  };

  const handleUpdatePermissions = async (uid: string, permissions: 'master' | 'standard') => {
    if (!canManageAll) return;
    const promise = updateDoc(doc(db, 'users', uid), { permissions });
    toast.promise(promise, {
      loading: 'Atualizando permissões...',
      success: 'Permissões atualizadas!',
      error: 'Erro ao atualizar.'
    });
  };

  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'pix' | 'credit' | 'debit' | 'cash'>('pix');

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAptForCheckout) return;

    const promise = (async () => {
      await updateDoc(doc(db, 'appointments', selectedAptForCheckout.id), {
        status: 'completed',
        paymentMethod: checkoutPaymentMethod
      });
      setIsCheckoutModalOpen(false);
      setSelectedAptForCheckout(null);
    })();

    toast.promise(promise, {
      loading: 'Finalizando atendimento...',
      success: 'Atendimento finalizado com sucesso!',
      error: 'Erro ao finalizar atendimento.'
    });
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManageAll) return;

    const promise = (async () => {
      const productData = {
        name: newProduct.name,
        description: newProduct.description,
        category: newProduct.category,
        price: parseFloat(newProduct.price),
        minStock: parseInt(newProduct.minStock),
        stock: 0,
        unit: newProduct.unit,
        lastUpdated: new Date().toISOString()
      };

      await addDoc(collection(db, 'products'), productData);
      setIsProductModalOpen(false);
      setNewProduct({ name: '', description: '', category: '', price: '', minStock: '5', unit: 'un' });
    })();

    toast.promise(promise, {
      loading: 'Adicionando produto...',
      success: 'Produto adicionado!',
      error: 'Erro ao adicionar produto.'
    });
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedProduct) return;

    const qty = parseInt(newMovement.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }

    const promise = (async () => {
      const newStock = newMovement.type === 'in' 
        ? selectedProduct.stock + qty 
        : selectedProduct.stock - qty;

      if (newStock < 0) throw new Error("Estoque insuficiente.");

      const movementData = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: newMovement.type,
        quantity: qty,
        reason: newMovement.reason,
        date: new Date().toISOString(),
        userId: user.uid,
        userName: user.name
      };

      await addDoc(collection(db, 'stock_movements'), movementData);
      await updateDoc(doc(db, 'products', selectedProduct.id), {
        stock: newStock,
        lastUpdated: new Date().toISOString()
      });

      setIsStockMovementModalOpen(false);
      setNewMovement({ type: 'in', quantity: '', reason: '' });
      setSelectedProduct(null);
    })();

    toast.promise(promise, {
      loading: 'Registrando movimentação...',
      success: 'Movimentação registrada!',
      error: (err: any) => err.message || 'Erro ao registrar movimentação.'
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !canManageAll) return;

    const promise = (async () => {
      const productData = {
        name: editingProduct.name,
        description: editingProduct.description,
        category: editingProduct.category,
        price: typeof editingProduct.price === 'string' ? parseFloat(editingProduct.price) : editingProduct.price,
        minStock: typeof editingProduct.minStock === 'string' ? parseInt(editingProduct.minStock) : editingProduct.minStock,
        unit: editingProduct.unit,
        lastUpdated: new Date().toISOString()
      };

      await updateDoc(doc(db, 'products', editingProduct.id), productData);
      setEditingProduct(null);
    })();

    toast.promise(promise, {
      loading: 'Atualizando produto...',
      success: 'Produto atualizado com sucesso!',
      error: 'Erro ao atualizar produto.'
    });
  };

  const handleDeleteProduct = async (id: string) => {
    if (!canManageAll) return;
    if (!window.confirm('Tem certeza que deseja remover este produto?')) return;

    const promise = updateDoc(doc(db, 'products', id), { deleted: true });
    toast.promise(promise, {
      loading: 'Removendo produto...',
      success: 'Produto removido.',
      error: 'Erro ao remover.'
    });
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManageAll) return;

    const promise = (async () => {
      // We use email as ID for easier lookup during registration
      await setDoc(doc(db, 'staff_invites', newInvite.email), {
        name: newInvite.name,
        email: newInvite.email,
        role: newInvite.role,
        permissions: newInvite.permissions,
        invitedBy: user.uid,
        createdAt: new Date().toISOString()
      });
      setIsInviteModalOpen(false);
      setNewInvite({ name: '', email: '', role: 'employee', permissions: 'standard' });
    })();

    toast.promise(promise, {
      loading: 'Enviando convite...',
      success: 'Funcionário convidado! Ele deve se cadastrar com este e-mail.',
      error: 'Erro ao convidar.'
    });
  };

  const handleDeleteStaff = async (uid: string) => {
    if (!canManageAll || uid === user?.uid) return;
    
    if (!window.confirm('Tem certeza que deseja remover este funcionário?')) return;

    const promise = (async () => {
      // Use soft delete (update) instead of physical delete to bypass missing delete rule
      // Use setDoc with merge to ensure it works even if doc doesn't exist
      await setDoc(doc(db, 'users', uid), { 
        deleted: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      // Also soft delete profile
      await setDoc(doc(db, 'profiles', uid), { 
        deleted: true 
      }, { merge: true });
    })();

    toast.promise(promise, {
      loading: 'Removendo funcionário...',
      success: 'Funcionário removido.',
      error: 'Erro ao remover.'
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !canManageAll) return;

    const promise = (async () => {
      // Use setDoc with merge for both to be safe and avoid "document not found" errors
      const userDocRef = doc(db, 'users', editingStaff.uid);
      const profileDocRef = doc(db, 'profiles', editingStaff.uid);

      await setDoc(userDocRef, {
        name: editingStaff.name,
        role: editingStaff.role,
        permissions: editingStaff.permissions,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      await setDoc(profileDocRef, {
        name: editingStaff.name,
        role: editingStaff.role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setIsEditStaffModalOpen(false);
      setEditingStaff(null);
    })();

    toast.promise(promise, {
      loading: 'Atualizando funcionário...',
      success: 'Funcionário atualizado!',
      error: 'Erro ao atualizar.'
    });
  };

  const handleExportCSV = () => {
    const headers = ['Data', 'Cliente', 'Barbeiro', 'Serviço', 'Preço', 'Pagamento', 'Status'];
    const rows = reportData.list.map(a => [
      format(parseISO(a.date), 'dd/MM/yyyy HH:mm'),
      a.clientName,
      a.barberName,
      a.serviceName,
      a.price.toFixed(2),
      a.paymentMethod || 'N/A',
      a.status === 'completed' ? 'Finalizado' : 'Confirmado'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_barbearia_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Permissions Helpers
  const canManageAll = user?.permissions === 'master';
  
  // Filtering appointments based on permissions
  const visibleAppointments = useMemo(() => {
    if (!user) return [];
    if (canManageAll) return appointments;
    return appointments.filter(a => a.barberId === user.uid);
  }, [appointments, user, canManageAll]);

  // Reports Logic
  const reportData = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;

    if (reportRange === 'day') {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (reportRange === 'week') {
      start = startOfWeek(now);
      end = endOfWeek(now);
    } else if (reportRange === 'month') {
      start = startOfMonth(now);
      end = endOfMonth(now);
    } else {
      start = startOfDay(parseISO(reportStartDate));
      end = endOfDay(parseISO(reportEndDate));
    }

    const filtered = visibleAppointments.filter(a => {
      const d = parseISO(a.date);
      const inInterval = isWithinInterval(d, { start, end });
      if (!inInterval) return false;

      // Barber Filter
      if (reportBarberFilter !== 'all' && a.barberId !== reportBarberFilter) return false;

      // Service Filter
      if (reportServiceFilter !== 'all' && a.serviceId !== reportServiceFilter) return false;

      // Time Filter
      const hour = d.getHours();
      if (reportTimeFilter === 'morning' && (hour < 6 || hour >= 12)) return false;
      if (reportTimeFilter === 'afternoon' && (hour < 12 || hour >= 18)) return false;
      if (reportTimeFilter === 'night' && (hour < 18 || hour >= 24)) return false;

      return true;
    });

    const totalRevenue = filtered.reduce((acc, curr) => acc + curr.price, 0);
    const totalCount = filtered.length;

    // Calculate top services
    const serviceCounts: Record<string, number> = {};
    filtered.forEach(a => {
      serviceCounts[a.serviceName] = (serviceCounts[a.serviceName] || 0) + 1;
    });

    const topServices = Object.entries(serviceCounts)
      .map(([name, count]) => ({
        name,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    // Calculate payment method breakdown
    const paymentCounts: Record<string, number> = {};
    filtered.forEach(a => {
      if (a.status === 'completed' && a.paymentMethod) {
        paymentCounts[a.paymentMethod] = (paymentCounts[a.paymentMethod] || 0) + 1;
      }
    });

    const paymentBreakdown = Object.entries(paymentCounts)
      .map(([method, count]) => ({
        method,
        count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return { totalRevenue, totalCount, list: filtered, topServices, paymentBreakdown };
  }, [visibleAppointments, reportRange, reportStartDate, reportEndDate, reportBarberFilter, reportServiceFilter, reportTimeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 md:p-6">
        <div className="max-w-md w-full bg-white rounded-[32px] md:rounded-[40px] p-8 md:p-12 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white mb-4">
              <Skull className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black tracking-tighter">Barbearia <span className="text-black/20">Skulls</span></h1>
            <p className="text-black/40 text-sm font-medium uppercase tracking-widest mt-2">Gestão Interna</p>
          </div>
          
          <div className="space-y-6">
            <div className="flex bg-black/5 p-1 rounded-2xl mb-6">
              <button 
                onClick={() => { setAuthMode('login'); setAuthError(null); }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                  authMode === 'login' ? "bg-white text-black shadow-sm" : "text-black/40"
                )}
              >
                Entrar
              </button>
              <button 
                onClick={() => { setAuthMode('register'); setAuthError(null); }}
                className={cn(
                  "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
                  authMode === 'register' ? "bg-white text-black shadow-sm" : "text-black/40"
                )}
              >
                Registrar
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">Nome Completo</label>
                  <input 
                    required 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" 
                    placeholder="Seu nome" 
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">E-mail</label>
                <input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" 
                  placeholder="seu@email.com" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">Senha</label>
                <input 
                  required 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" 
                  placeholder="••••••••" 
                />
                {authMode === 'login' && (
                  <div className="flex justify-end px-2">
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black transition-colors"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                )}
              </div>
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-black/30 ml-2">Confirmar Senha</label>
                  <input 
                    required 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" 
                    placeholder="••••••••" 
                  />
                </div>
              )}

              {authError && (
                <p className="text-xs font-bold text-red-500 text-center bg-red-50 p-3 rounded-xl">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                className="w-full py-5 bg-black text-white rounded-3xl font-bold text-lg hover:scale-[1.02] transition-transform shadow-xl shadow-black/10"
              >
                {authMode === 'login' ? 'Entrar no Sistema' : 'Criar Minha Conta'}
              </button>
            </form>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/5"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest text-black/20">
                <span className="bg-white px-4">Ou continue com</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-4 border-2 border-black/5 rounded-3xl flex items-center justify-center gap-3 hover:bg-black hover:text-white transition-all font-bold"
            >
              <LogIn className="w-5 h-5" /> Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#1a1a1a] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-black/5 p-8 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white">
            <Skull className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight">Barbearia Skulls</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem active={view === 'dashboard'} icon={LayoutDashboard} label="Dashboard" onClick={() => setView('dashboard')} />
          <SidebarItem active={view === 'agenda'} icon={CalendarIcon} label="Agenda" onClick={() => setView('agenda')} />
          {canManageAll && (
            <>
              <SidebarItem active={view === 'services'} icon={Scissors} label="Serviços" onClick={() => setView('services')} />
              <SidebarItem active={view === 'staff'} icon={Users} label="Equipe" onClick={() => setView('staff')} />
              <SidebarItem active={view === 'stock'} icon={Package} label="Estoque" onClick={() => setView('stock')} />
            </>
          )}
          <SidebarItem active={view === 'reports'} icon={TrendingUp} label="Relatórios" onClick={() => setView('reports')} />
        </nav>

        <div className="pt-8 border-t border-black/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center font-bold">
              {(user.name || 'U')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">{user.name}</p>
              <p className="text-[10px] text-black/40 uppercase font-black tracking-widest">{user.permissions}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors">
            <LogOut className="w-4 h-4" /> Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-black/5 p-4 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <Skull className="w-6 h-6" />
            <span className="font-bold">Barbearia Skulls</span>
          </div>
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-black/5 rounded-xl transition-colors">
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-30 bg-white lg:hidden pt-20 p-6 flex flex-col"
            >
              <nav className="flex-1 space-y-4">
                <SidebarItem 
                  active={view === 'dashboard'} 
                  icon={LayoutDashboard} 
                  label="Dashboard" 
                  onClick={() => { setView('dashboard'); setIsMenuOpen(false); }} 
                />
                <SidebarItem 
                  active={view === 'agenda'} 
                  icon={CalendarIcon} 
                  label="Agenda" 
                  onClick={() => { setView('agenda'); setIsMenuOpen(false); }} 
                />
                {canManageAll && (
                  <>
                    <SidebarItem 
                      active={view === 'services'} 
                      icon={Scissors} 
                      label="Serviços" 
                      onClick={() => { setView('services'); setIsMenuOpen(false); }} 
                    />
                    <SidebarItem 
                      active={view === 'staff'} 
                      icon={Users} 
                      label="Equipe" 
                      onClick={() => { setView('staff'); setIsMenuOpen(false); }} 
                    />
                    <SidebarItem 
                      active={view === 'stock'} 
                      icon={Package} 
                      label="Estoque" 
                      onClick={() => { setView('stock'); setIsMenuOpen(false); }} 
                    />
                  </>
                )}
                <SidebarItem 
                  active={view === 'reports'} 
                  icon={TrendingUp} 
                  label="Relatórios" 
                  onClick={() => { setView('reports'); setIsMenuOpen(false); }} 
                />
              </nav>

              <div className="pt-8 border-t border-black/5 mt-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center font-bold text-lg">
                    {(user.name || 'U')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg truncate">{user.name}</p>
                    <p className="text-xs text-black/40 uppercase font-black tracking-widest">{user.permissions}</p>
                  </div>
                </div>
                <button 
                  onClick={handleLogout} 
                  className="w-full flex items-center justify-center gap-3 p-5 bg-red-50 text-red-500 font-bold rounded-2xl transition-all active:scale-95"
                >
                  <LogOut className="w-5 h-5" /> Sair do Sistema
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="p-4 lg:p-12 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {view === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight">Painel de Controle</h2>
                    <p className="text-black/40 font-medium">Bem-vindo de volta, {(user.name || 'Usuário').split(' ')[0]}.</p>
                  </div>
                  <button 
                    onClick={() => setIsBookingModalOpen(true)}
                    className="px-8 py-4 bg-black text-white rounded-3xl font-bold flex items-center gap-3 hover:scale-105 transition-transform shadow-xl shadow-black/10"
                  >
                    <Plus className="w-5 h-5" /> Novo Agendamento
                  </button>
                </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StatCard icon={DollarSign} label="Ganhos Hoje" value={`R$ ${reportData.totalRevenue.toFixed(2)}`} color="bg-green-500" />
              <StatCard icon={CalendarIcon} label="Agendamentos" value={reportData.totalCount.toString()} color="bg-blue-500" />
              <StatCard icon={Users} label="Clientes Atendidos" value={reportData.totalCount.toString()} color="bg-purple-500" />
            </div>

            {products.some(p => p.stock <= p.minStock) && (
              <div className="bg-red-50 border border-red-100 rounded-[32px] p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-3 text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                  <h3 className="text-lg font-black uppercase tracking-widest">Alertas de Estoque Baixo</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.filter(p => p.stock <= p.minStock).map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-2xl border border-red-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{p.name}</p>
                        <p className="text-[10px] text-red-500 font-black uppercase tracking-widest">
                          {p.stock} {p.unit} (Mín: {p.minStock})
                        </p>
                      </div>
                      <button 
                        onClick={() => { setSelectedProduct(p); setIsStockMovementModalOpen(true); }}
                        className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-black/5 shadow-sm">
              <h3 className="text-xl font-bold mb-6">Próximos na Agenda</h3>
              <div className="space-y-4">
                {visibleAppointments.length === 0 ? (
                  <p className="text-center py-10 text-black/20 font-bold italic">Nenhum agendamento para hoje.</p>
                ) : (
                  visibleAppointments.slice(0, 5).map(apt => (
                    <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 bg-[#fcfcfc] rounded-2xl md:rounded-3xl border border-black/5 gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center font-black text-lg shrink-0">
                          {format(parseISO(apt.date), 'HH:mm')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold truncate">{apt.clientName}</p>
                          <p className="text-xs text-black/40 flex items-center gap-1 truncate"><Phone className="w-3 h-3" /> {apt.clientPhone}</p>
                        </div>
                      </div>
                      <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-black/5">
                        <p className="text-sm font-bold">{apt.serviceName}</p>
                        <p className="text-[10px] uppercase font-black tracking-widest text-black/30">Barbeiro: {apt.barberName}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
              </motion.div>
            )}

            {view === 'agenda' && (
              <motion.div key="agenda" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">Agenda</h2>
                    <p className="text-black/40 font-medium capitalize">
                      {format(agendaDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between md:justify-start gap-3 bg-white p-2 rounded-2xl border border-black/5 shadow-sm w-full md:w-auto">
                    <button 
                      onClick={() => setAgendaDate(subDays(agendaDate, 1))}
                      className="p-3 hover:bg-black/5 rounded-xl transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <button
                      onClick={() => setAgendaDate(new Date())}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      Hoje
                    </button>
                    <div className="px-4 font-bold text-sm min-w-[120px] text-center flex-1 md:flex-none">
                      {isSameDay(agendaDate, new Date()) ? 'Hoje' : format(agendaDate, 'dd/MM/yyyy')}
                    </div>
                    <button 
                      onClick={() => setAgendaDate(addDays(agendaDate, 1))}
                      className="p-3 hover:bg-black/5 rounded-xl transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-12">
                  {(canManageAll ? staff : staff.filter(s => s.uid === user?.uid)).map(barber => (
                    <div key={barber.uid} className="bg-white rounded-[32px] md:rounded-[40px] p-6 md:p-8 border border-black/5 shadow-sm space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black text-white rounded-2xl flex items-center justify-center font-black shrink-0">
                          {(barber.name || 'U')[0]}
                        </div>
                        <div>
                          <h3 className="text-xl font-black">{barber.name}</h3>
                          <p className="text-xs text-black/40 font-bold uppercase tracking-widest">Agenda Individual</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-3xl border border-black/5 overflow-hidden">
                        <div className="overflow-x-auto">
                          <div className="min-w-[600px]">
                            {/* Header */}
                            <div className="grid grid-cols-[100px_1fr] border-b border-black/5 bg-black/5">
                              <div className="p-4 font-black text-[10px] uppercase tracking-widest text-black/30 border-r border-black/5 text-center">Horário</div>
                              <div className="p-4 font-black text-[10px] uppercase tracking-widest text-black/30 text-center">Agendamento</div>
                            </div>

                            {/* Rows */}
                            <div className="divide-y divide-black/5">
                              {TIME_SLOTS.map(time => {
                                const apt = appointments.find(a => 
                                  a.barberId === barber.uid && 
                                  isSameDay(parseISO(a.date), agendaDate) &&
                                  format(parseISO(a.date), 'HH:mm') === time
                                );

                                return (
                                  <div key={time} className="grid grid-cols-[100px_1fr] min-h-[70px] hover:bg-black/[0.01] transition-colors">
                                    <div className="p-4 font-bold text-xs text-black/30 border-r border-black/5 flex items-center justify-center bg-black/[0.02]">{time}</div>
                                    <div className="p-2 relative group flex items-center">
                                      {apt ? (
                                        <div 
                                          onClick={() => {
                                            setSelectedAptForCheckout(apt);
                                            if (apt.status !== 'completed') setIsCheckoutModalOpen(true);
                                          }}
                                          className={cn(
                                            "w-full p-3 rounded-2xl text-left transition-all cursor-pointer shadow-sm border border-black/5 flex items-center justify-between",
                                            apt.status === 'completed' ? "bg-green-50 text-green-800" : "bg-indigo-50 text-indigo-800"
                                          )}
                                        >
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <p className="font-black text-xs truncate">{apt.clientName}</p>
                                              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{apt.duration}m</span>
                                            </div>
                                            <p className="text-[10px] font-bold opacity-60 truncate flex items-center gap-1">
                                              <Scissors className="w-3 h-3" /> {apt.serviceName}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <a 
                                              href={`https://wa.me/55${apt.clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá ${apt.clientName}, confirmando seu agendamento na Barbearia Skulls para o dia ${format(parseISO(apt.date), 'dd/MM')} às ${format(parseISO(apt.date), 'HH:mm')}.`)}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                                            >
                                              <Phone className="w-3 h-3" />
                                            </a>
                                            {canManageAll && (
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteAppointment(apt.id);
                                                }}
                                                className="p-2 text-red-400 hover:text-red-600 transition-all"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <button 
                                          onClick={() => {
                                            setNewApt({
                                              ...newApt, 
                                              barberId: barber.uid, 
                                              date: format(agendaDate, 'yyyy-MM-dd'),
                                              time: time
                                            });
                                            setIsBookingModalOpen(true);
                                          }}
                                          className="w-full h-full opacity-0 group-hover:opacity-100 flex items-center justify-center text-indigo-400 hover:text-indigo-600 transition-all gap-2 font-bold text-xs"
                                        >
                                          <Plus className="w-4 h-4" /> Novo Agendamento
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'reports' && (
              <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                  <div>
                    <h2 className="text-4xl font-black tracking-tight">Relatórios e Lucros</h2>
                    <p className="text-black/40 font-medium">Acompanhe o desempenho financeiro.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={handleExportCSV}
                      className="px-6 py-3 border-2 border-black/5 rounded-2xl font-bold flex items-center gap-2 hover:bg-black/5 transition-all"
                    >
                      <Package className="w-4 h-4" /> Exportar CSV
                    </button>
                    <button 
                      onClick={() => {
                        setReportRange('day');
                        setReportBarberFilter('all');
                        setReportServiceFilter('all');
                        setReportTimeFilter('all');
                      }}
                      className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
                    >
                      Limpar Filtros
                    </button>
                    <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
                      {(['day', 'week', 'month', 'custom'] as const).map(range => (
                        <button
                          key={range}
                          onClick={() => setReportRange(range)}
                          className={cn(
                            "px-4 md:px-6 py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase tracking-widest transition-all",
                            reportRange === range ? "bg-black text-white" : "text-black/40 hover:text-black"
                          )}
                        >
                          {range === 'day' ? 'Diário' : range === 'week' ? 'Semanal' : range === 'month' ? 'Mensal' : 'Personalizado'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-6 rounded-[32px] border border-black/5 shadow-sm">
                  {reportRange === 'custom' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Início</label>
                        <input 
                          type="date" 
                          value={reportStartDate} 
                          onChange={e => setReportStartDate(e.target.value)}
                          className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-black text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Fim</label>
                        <input 
                          type="date" 
                          value={reportEndDate} 
                          onChange={e => setReportEndDate(e.target.value)}
                          className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-black text-sm"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Barbeiro</label>
                    <select 
                      value={reportBarberFilter} 
                      onChange={e => setReportBarberFilter(e.target.value)}
                      className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-black text-sm"
                    >
                      <option value="all">Todos os Barbeiros</option>
                      {staff.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Serviço</label>
                    <select 
                      value={reportServiceFilter} 
                      onChange={e => setReportServiceFilter(e.target.value)}
                      className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-black text-sm"
                    >
                      <option value="all">Todos os Serviços</option>
                      {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/30">Período do Dia</label>
                    <select 
                      value={reportTimeFilter} 
                      onChange={e => setReportTimeFilter(e.target.value as any)}
                      className="w-full p-3 bg-black/5 rounded-xl border-none focus:ring-2 focus:ring-black text-sm"
                    >
                      <option value="all">Dia Inteiro</option>
                      <option value="morning">Manhã (06:00 - 12:00)</option>
                      <option value="afternoon">Tarde (12:00 - 18:00)</option>
                      <option value="night">Noite (18:00 - 00:00)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-black text-white rounded-[40px] p-10 flex flex-col justify-between min-h-[300px] relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <TrendingUp className="w-32 h-32" />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Total de Receita</p>
                      <h3 className="text-6xl font-black tracking-tighter">R$ {reportData.totalRevenue.toFixed(2)}</h3>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                        <TrendingUp className="w-4 h-4" /> +12% em relação ao período anterior
                      </div>
                      <p className="text-[10px] text-white/30 uppercase font-black tracking-tighter">
                        Filtro: {reportRange === 'custom' ? `${reportStartDate} a ${reportEndDate}` : reportRange} 
                        {reportBarberFilter !== 'all' && ` • Barbeiro: ${staff.find(s => s.uid === reportBarberFilter)?.name}`}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-[40px] p-10 border border-black/5 flex flex-col justify-between min-h-[300px]">
                    <div>
                      <p className="text-black/40 text-xs font-bold uppercase tracking-widest mb-2">Serviços Realizados</p>
                      <h3 className="text-6xl font-black tracking-tighter">{reportData.totalCount}</h3>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-black/60">Top Serviços:</p>
                      <div className="flex flex-wrap gap-2">
                        {reportData.topServices.length > 0 ? (
                          reportData.topServices.map((s, idx) => (
                            <span key={idx} className="px-3 py-1 bg-black/5 rounded-lg text-xs font-bold">
                              {s.name} ({s.percentage}%)
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-black/20 italic">Nenhum dado disponível</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 border border-black/5">
                  <h3 className="text-xl font-bold mb-6">Detalhamento por Barbeiro</h3>
                  <div className="space-y-4">
                    {staff.map(s => {
                      const staffApts = reportData.list.filter(a => a.barberId === s.uid);
                      const revenue = staffApts.reduce((acc, curr) => acc + curr.price, 0);
                      return (
                        <div key={s.uid} className="flex items-center justify-between p-6 bg-[#fcfcfc] rounded-3xl border border-black/5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center font-bold">{(s.name || 'U')[0]}</div>
                            <p className="font-bold">{s.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black">R$ {revenue.toFixed(2)}</p>
                            <p className="text-[10px] text-black/30 font-bold uppercase">{staffApts.length} atendimentos</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-[40px] p-8 border border-black/5">
                  <h3 className="text-xl font-bold mb-6">Detalhamento por Pagamento</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {reportData.paymentBreakdown.length > 0 ? (
                      reportData.paymentBreakdown.map((p, idx) => (
                        <div key={idx} className="p-6 bg-[#fcfcfc] rounded-3xl border border-black/5 flex flex-col items-center justify-center text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/30 mb-1">{p.method}</p>
                          <p className="text-2xl font-black tracking-tighter">{p.count}</p>
                          <p className="text-[10px] text-black/40 font-bold uppercase">{p.percentage}% do total</p>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-12 text-center text-black/20 italic">
                        Nenhum pagamento registrado no período.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'staff' && (
              <motion.div key="staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight">Equipe</h2>
                  {canManageAll && (
                    <button 
                      onClick={() => setIsInviteModalOpen(true)}
                      className="px-6 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform w-full sm:w-auto"
                    >
                      <Plus className="w-4 h-4" /> Convidar Funcionário
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {staff.map(s => (
                    <div key={s.uid} className="p-6 md:p-8 bg-white rounded-[32px] md:rounded-[40px] border border-black/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 md:p-6 flex gap-2">
                        <button 
                          onClick={() => { setEditingStaff(s); setIsEditStaffModalOpen(true); }}
                          className="p-2 hover:bg-black/5 rounded-xl transition-colors"
                        >
                          <Settings className="w-5 h-5 text-black/20" />
                        </button>
                        {s.uid !== user.uid && (
                          <button 
                            onClick={() => handleDeleteStaff(s.uid)}
                            className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-5 h-5 text-red-400" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-4 md:gap-6 mb-8">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-black/5 rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl font-black shrink-0">
                          {(s.name || 'U')[0]}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl md:text-2xl font-black truncate">{s.name}</h3>
                          <p className="text-black/40 text-sm truncate">{s.email}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center justify-between p-3 md:p-4 bg-black/5 rounded-xl md:rounded-2xl">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Cargo</span>
                          <span className="font-bold text-sm md:text-base">{s.role === 'owner' ? 'Proprietário' : 'Funcionário'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 md:p-4 bg-black/5 rounded-xl md:rounded-2xl">
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">Permissão</span>
                          <select 
                            disabled={!canManageAll || s.uid === user.uid}
                            value={s.permissions}
                            onChange={(e) => handleUpdatePermissions(s.uid, e.target.value as 'master' | 'standard')}
                            className="bg-transparent font-bold text-sm border-none focus:ring-0 cursor-pointer disabled:cursor-not-allowed text-right"
                          >
                            <option value="master">Master</option>
                            <option value="standard">Padrão</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'services' && (
              <motion.div key="services" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h2 className="text-3xl md:text-4xl font-black tracking-tight">Serviços</h2>
                  <button 
                    onClick={() => setIsServiceModalOpen(true)}
                    className="px-6 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" /> Novo Serviço
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {services.map(s => (
                    <div key={s.id} className="p-6 md:p-8 bg-white rounded-[32px] md:rounded-[40px] border border-black/5 flex flex-col justify-between min-h-[220px] md:min-h-[240px]">
                      <div>
                        <div className="flex justify-between items-start mb-4 gap-2">
                          <h3 className="text-lg md:text-xl font-black truncate">{s.name}</h3>
                          <span className="font-mono font-bold text-indigo-600 shrink-0">R$ {s.price.toFixed(2)}</span>
                        </div>
                        <p className="text-black/40 text-sm mb-6 line-clamp-2">{s.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-6 border-t border-black/5">
                        <span className="text-xs font-bold text-black/30 flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration} min</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingService(s)}
                            className="p-2 hover:bg-black/5 rounded-lg transition-colors"
                          >
                            <Settings className="w-4 h-4 text-black/20" />
                          </button>
                          <button onClick={() => handleDeleteService(s.id)} className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
            {view === 'stock' && (
              <motion.div key="stock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight">Gerenciamento de Estoque</h2>
                    <p className="text-black/40 font-medium">Controle de produtos e suprimentos.</p>
                  </div>
                  <button 
                    onClick={() => setIsProductModalOpen(true)}
                    className="px-6 py-3 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4" /> Novo Produto
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {products.map(p => (
                        <div key={p.id} className={cn(
                          "p-6 bg-white rounded-[32px] border transition-all hover:shadow-lg group relative overflow-hidden",
                          p.stock <= p.minStock ? "border-red-200 bg-red-50/30" : "border-black/5"
                        )}>
                          {p.stock <= p.minStock && (
                            <div className="absolute top-0 right-0 p-4">
                              <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
                            </div>
                          )}
                          <div className="mb-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-black/30 mb-1">{p.category}</p>
                            <h3 className="text-xl font-black truncate">{p.name}</h3>
                            <p className="text-xs text-black/40 line-clamp-1">{p.description}</p>
                          </div>
                          
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Estoque Atual</p>
                              <p className={cn(
                                "text-3xl font-black tracking-tighter",
                                p.stock <= p.minStock ? "text-red-600" : "text-black"
                              )}>
                                {p.stock} <span className="text-sm font-bold opacity-40 uppercase">{p.unit}</span>
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setEditingProduct(p)}
                                className="p-3 bg-white border border-black/5 text-black/40 rounded-2xl hover:bg-black hover:text-white transition-all shadow-sm"
                                title="Editar Produto"
                              >
                                <Settings className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => { setSelectedProduct(p); setIsStockMovementModalOpen(true); }}
                                className="p-3 bg-black text-white rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-black/10"
                                title="Movimentar Estoque"
                              >
                                <History className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-3 bg-red-50 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                                title="Remover Produto"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                          
                          <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-black/30">
                            <span>Mínimo: {p.minStock} {p.unit}</span>
                            <span>Preço: R$ {p.price.toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white rounded-[32px] border border-black/5 p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-6">
                        <History className="w-5 h-5 text-black/40" />
                        <h3 className="text-lg font-bold">Últimas Movimentações</h3>
                      </div>
                      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {stockMovements.length === 0 ? (
                          <p className="text-center py-10 text-black/20 font-bold italic">Nenhuma movimentação registrada.</p>
                        ) : (
                          stockMovements.map(m => (
                            <div key={m.id} className="p-4 bg-black/5 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {m.type === 'in' ? (
                                    <ArrowUpCircle className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <ArrowDownCircle className="w-4 h-4 text-red-500" />
                                  )}
                                  <span className="font-bold text-sm">{m.productName}</span>
                                </div>
                                <span className={cn(
                                  "text-xs font-black",
                                  m.type === 'in' ? "text-green-600" : "text-red-600"
                                )}>
                                  {m.type === 'in' ? '+' : '-'}{m.quantity}
                                </span>
                              </div>
                              <p className="text-[10px] text-black/40 leading-tight">{m.reason || 'Sem observações'}</p>
                              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-black/20">
                                <span>{format(parseISO(m.date), 'dd/MM/yy HH:mm')}</span>
                                <span>Por: {(m.userName || 'Usuário').split(' ')[0]}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {isBookingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsBookingModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Novo Agendamento</h2>
                <button onClick={() => setIsBookingModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleAddAppointment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome do Cliente</label>
                    <input required type="text" value={newApt.clientName} onChange={e => setNewApt({...newApt, clientName: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: João Silva" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">WhatsApp</label>
                    <input required type="tel" value={newApt.clientPhone} onChange={e => setNewApt({...newApt, clientPhone: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="(00) 00000-0000" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Serviço</label>
                  <select required value={newApt.serviceId} onChange={e => setNewApt({...newApt, serviceId: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black">
                    <option value="">Selecione um serviço</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - R$ {s.price.toFixed(2)}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Barbeiro Responsável</label>
                  <select required value={newApt.barberId} onChange={e => setNewApt({...newApt, barberId: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black">
                    <option value="">Selecione o barbeiro</option>
                    {staff.map(s => <option key={s.uid} value={s.uid}>{s.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Data</label>
                    <input required type="date" value={newApt.date} onChange={e => setNewApt({...newApt, date: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Horário</label>
                    <input required type="time" value={newApt.time} onChange={e => setNewApt({...newApt, time: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" />
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Salvar Agendamento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Service Modal */}
      <AnimatePresence>
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsServiceModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Novo Serviço</h2>
                <button onClick={() => setIsServiceModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleAddService} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome do Serviço</label>
                  <input required type="text" value={newService.name} onChange={e => setNewService({...newService, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Corte de Cabelo" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Descrição</label>
                  <textarea value={newService.description} onChange={e => setNewService({...newService, description: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black min-h-[100px]" placeholder="Breve descrição do serviço..." />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Preço (R$)</label>
                    <input required type="number" step="0.01" value={newService.price} onChange={e => setNewService({...newService, price: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Duração (min)</label>
                    <input required type="number" value={newService.duration} onChange={e => setNewService({...newService, duration: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="30" />
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Salvar Serviço
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Service Modal */}
      <AnimatePresence>
        {editingService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingService(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Editar Serviço</h2>
                <button onClick={() => setEditingService(null)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleUpdateService} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome do Serviço</label>
                  <input required type="text" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Corte de Cabelo" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Descrição</label>
                  <textarea value={editingService.description} onChange={e => setEditingService({...editingService, description: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black min-h-[100px]" placeholder="Breve descrição do serviço..." />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Preço (R$)</label>
                    <input required type="number" step="0.01" value={editingService.price} onChange={e => setEditingService({...editingService, price: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Duração (min)</label>
                    <input required type="number" value={editingService.duration} onChange={e => setEditingService({...editingService, duration: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="30" />
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Atualizar Serviço
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditingProduct(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Editar Produto</h2>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleUpdateProduct} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome do Produto</label>
                  <input required type="text" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Pomada Modeladora" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Descrição</label>
                  <textarea value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black min-h-[100px]" placeholder="Breve descrição do produto..." />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Categoria</label>
                    <input required type="text" value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Cabelo" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Preço (R$)</label>
                    <input required type="number" step="0.01" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="0,00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Estoque Mínimo</label>
                    <input required type="number" value={editingProduct.minStock} onChange={e => setEditingProduct({...editingProduct, minStock: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="5" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Unidade</label>
                    <input required type="text" value={editingProduct.unit} onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: un, ml, g" />
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Atualizar Produto
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsInviteModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Convidar Funcionário</h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleInviteStaff} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome Completo</label>
                  <input required type="text" value={newInvite.name} onChange={e => setNewInvite({...newInvite, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Carlos Barbeiro" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">E-mail de Cadastro</label>
                  <input required type="email" value={newInvite.email} onChange={e => setNewInvite({...newInvite, email: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="email@exemplo.com" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Cargo</label>
                    <select value={newInvite.role} onChange={e => setNewInvite({...newInvite, role: e.target.value as any})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold">
                      <option value="employee">Funcionário</option>
                      <option value="owner">Proprietário</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Permissão</label>
                    <select value={newInvite.permissions} onChange={e => setNewInvite({...newInvite, permissions: e.target.value as any})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold">
                      <option value="standard">Padrão (Sua Agenda)</option>
                      <option value="master">Master (Acesso Total)</option>
                    </select>
                  </div>
                </div>

                <p className="text-[10px] text-black/30 font-bold uppercase leading-relaxed">
                  * O funcionário deve criar uma conta usando exatamente este e-mail para que as permissões sejam aplicadas automaticamente.
                </p>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Enviar Convite
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Staff Modal */}
      <AnimatePresence>
        {isEditStaffModalOpen && editingStaff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEditStaffModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Editar Funcionário</h2>
                <button onClick={() => setIsEditStaffModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleUpdateStaff} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome Completo</label>
                  <input required type="text" value={editingStaff.name} onChange={e => setEditingStaff({...editingStaff, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Cargo</label>
                    <select value={editingStaff.role} onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold">
                      <option value="employee">Funcionário</option>
                      <option value="owner">Proprietário</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Permissão</label>
                    <select value={editingStaff.permissions} onChange={e => setEditingStaff({...editingStaff, permissions: e.target.value as any})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold">
                      <option value="standard">Padrão (Apenas Agenda)</option>
                      <option value="master">Master (Acesso Total)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Salvar Alterações
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProductModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl md:text-3xl font-black tracking-tight">Novo Produto</h2>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleAddProduct} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Nome do Produto</label>
                  <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Pomada Modeladora" />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Descrição</label>
                  <textarea value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black min-h-[100px]" placeholder="Breve descrição do produto..." />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Categoria</label>
                    <input required type="text" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="Ex: Cabelo" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Unidade</label>
                    <select value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black font-bold">
                      <option value="un">Unidade (un)</option>
                      <option value="ml">Mililitros (ml)</option>
                      <option value="g">Gramas (g)</option>
                      <option value="kg">Quilos (kg)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Preço (R$)</label>
                    <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Estoque Mínimo</label>
                    <input required type="number" value={newProduct.minStock} onChange={e => setNewProduct({...newProduct, minStock: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="5" />
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Cadastrar Produto
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Movement Modal */}
      <AnimatePresence>
        {isStockMovementModalOpen && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsStockMovementModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">Movimentar Estoque</h2>
                  <p className="text-black/40 font-medium">{selectedProduct.name}</p>
                </div>
                <button onClick={() => setIsStockMovementModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleStockMovement} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Tipo de Movimento</label>
                    <div className="flex bg-black/5 p-1 rounded-2xl">
                      <button 
                        type="button"
                        onClick={() => setNewMovement({...newMovement, type: 'in'})}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                          newMovement.type === 'in' ? "bg-white text-green-600 shadow-sm" : "text-black/40"
                        )}
                      >
                        Entrada
                      </button>
                      <button 
                        type="button"
                        onClick={() => setNewMovement({...newMovement, type: 'out'})}
                        className={cn(
                          "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                          newMovement.type === 'out' ? "bg-white text-red-600 shadow-sm" : "text-black/40"
                        )}
                      >
                        Saída
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-black/30">Quantidade ({selectedProduct.unit})</label>
                    <input required type="number" value={newMovement.quantity} onChange={e => setNewMovement({...newMovement, quantity: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black" placeholder="0" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30">Motivo / Observação</label>
                  <textarea required value={newMovement.reason} onChange={e => setNewMovement({...newMovement, reason: e.target.value})} className="w-full p-4 bg-black/5 rounded-2xl border-none focus:ring-2 focus:ring-black min-h-[100px]" placeholder="Ex: Compra de fornecedor, Uso em serviço..." />
                </div>

                <div className="p-6 bg-black/5 rounded-[32px] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/40 font-bold uppercase tracking-widest text-[10px]">Estoque Atual</span>
                    <span className="font-black">{selectedProduct.stock} {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-black/40 font-bold uppercase tracking-widest text-[10px]">Após Movimentação</span>
                    <span className={cn(
                      "font-black",
                      newMovement.type === 'in' ? "text-green-600" : "text-red-600"
                    )}>
                      {newMovement.type === 'in' 
                        ? selectedProduct.stock + (parseInt(newMovement.quantity) || 0)
                        : selectedProduct.stock - (parseInt(newMovement.quantity) || 0)
                      } {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Confirmar Movimentação
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && selectedAptForCheckout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsCheckoutModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-xl rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">Finalizar Atendimento</h2>
                  <p className="text-black/40 font-medium">{selectedAptForCheckout.clientName} • {selectedAptForCheckout.serviceName}</p>
                </div>
                <button onClick={() => setIsCheckoutModalOpen(false)} className="p-2 hover:bg-black/5 rounded-xl"><X /></button>
              </div>

              <form onSubmit={handleCheckout} className="space-y-8">
                <div className="p-8 bg-black/5 rounded-[40px] text-center space-y-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-black/30">Total a Receber</p>
                  <p className="text-5xl font-black tracking-tighter">R$ {selectedAptForCheckout.price.toFixed(2)}</p>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-black/30 ml-2">Forma de Pagamento</label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'pix', label: 'PIX', icon: ArrowRight },
                      { id: 'credit', label: 'Cartão Crédito', icon: DollarSign },
                      { id: 'debit', label: 'Cartão Débito', icon: DollarSign },
                      { id: 'cash', label: 'Dinheiro', icon: DollarSign }
                    ].map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setCheckoutPaymentMethod(method.id as any)}
                        className={cn(
                          "p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 font-bold",
                          checkoutPaymentMethod === method.id 
                            ? "border-black bg-black text-white shadow-xl shadow-black/10 scale-[1.02]" 
                            : "border-black/5 hover:border-black/20"
                        )}
                      >
                        <method.icon className={cn("w-6 h-6", checkoutPaymentMethod === method.id ? "text-white" : "text-black/20")} />
                        <span>{method.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" className="w-full py-6 bg-black text-white rounded-3xl text-xl font-black shadow-xl shadow-black/10 hover:scale-[1.02] transition-transform mt-4">
                  Confirmar Recebimento
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />
    </div>
  );
}

function SidebarItem({ active, icon: Icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl font-bold transition-all",
        active ? "bg-black text-white shadow-lg shadow-black/10" : "text-black/40 hover:bg-black/5 hover:text-black"
      )}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-white p-8 rounded-[40px] border border-black/5 flex items-center gap-6">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", color)}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-black/30 mb-1">{label}</p>
        <p className="text-3xl font-black tracking-tight">{value}</p>
      </div>
    </div>
  );
}
