import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChecklistTemplate, 
  PointLocation, 
  StaffMember, 
  BlockAnswer, 
  ChecklistSubmission,
  ManagerUser,
  CompanyOrganization
} from '../../types';
import { PREBUILT_TEMPLATES, INITIAL_POINTS, INITIAL_STAFF } from '../../mockData';
import { CameraModal } from './CameraModal';
import { uploadToS3, submitChecklist } from '../../services/storage';
import { saveSubmissionToYdb } from '../../services/ydbSubmissionService';
import { 
  getActiveOrganization, 
  getOrganizations, 
  getOrganizationsForUser, 
  setActiveOrganization, 
  cleanInnString 
} from '../../services/companyService';
import { 
  Smartphone, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  Clock, 
  MapPin, 
  User, 
  UserCheck,
  ArrowLeft, 
  Sparkles, 
  Check, 
  ShieldCheck, 
  ShieldAlert,
  Trash2, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Info,
  Building2,
  ChevronDown,
  Lock,
  SlidersHorizontal,
  X,
  Layers,
  Key,
  Delete
} from 'lucide-react';

interface MobileFormRunnerProps {
  templates: ChecklistTemplate[];
  points: PointLocation[];
  staffList: StaffMember[];
  initialTemplateId?: string;
  initialPointId?: string;
  networkOnline: boolean;
  onViewInspectionDoc: (docNumber: string) => void;
  onRefreshSubmissions: () => void;
  isStandaloneMobilePreview?: boolean;
  onSwitchToManagerPanel?: () => void;
  currentUser?: ManagerUser | null;
  onOpenLoginModal?: () => void;
}

export const MobileFormRunner: React.FC<MobileFormRunnerProps> = ({
  templates,
  points,
  staffList,
  initialTemplateId,
  initialPointId,
  networkOnline,
  onViewInspectionDoc,
  onRefreshSubmissions,
  isStandaloneMobilePreview = false,
  onSwitchToManagerPanel,
  currentUser,
  onOpenLoginModal,
}) => {
  // Defensive fallbacks to ensure the runner ALWAYS has valid templates and points
  const safeTemplates = templates && templates.length > 0 ? templates : PREBUILT_TEMPLATES;
  const safePoints = points && points.length > 0 ? points : INITIAL_POINTS;
  const safeStaff = staffList && staffList.length > 0 ? staffList : INITIAL_STAFF;

  // Selection states with guaranteed non-null fallbacks
  const [selectedPointId, setSelectedPointId] = useState<string>(() => {
    if (initialPointId && safePoints.some(p => p.id === initialPointId)) {
      return initialPointId;
    }
    return safePoints[0]?.id || '';
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    if (initialTemplateId && safeTemplates.some(t => t.id === initialTemplateId)) {
      return initialTemplateId;
    }
    return safeTemplates[0]?.id || '';
  });

  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    const targetPoint = (initialPointId && safePoints.some(p => p.id === initialPointId)) 
      ? initialPointId 
      : safePoints[0]?.id;
    const match = safeStaff.find(s => 
      (Array.isArray(s.pointIds) && s.pointIds.includes(targetPoint)) || s.pointId === targetPoint
    );
    return match?.id || safeStaff[0]?.id || '';
  });

  // Staff PIN Authentication states
  const [authenticatedStaffId, setAuthenticatedStaffId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('horeca_barista_auth_staff_id');
    } catch {
      return null;
    }
  });
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<boolean>(false);

  // Require staff PIN auth when opened via direct link or QR code unless already authenticated in session
  const [activeStep, setActiveStep] = useState<'auth' | 'form' | 'success'>(() => {
    try {
      const saved = sessionStorage.getItem('horeca_barista_auth_staff_id');
      if (saved) return 'form';
    } catch {}
    return 'auth';
  });

  const [answers, setAnswers] = useState<Record<string, Partial<BlockAnswer>>>({});
  const [activeCameraBlockId, setActiveCameraBlockId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lastSubmissionResult, setLastSubmissionResult] = useState<{
    submission: ChecklistSubmission;
    queued: boolean;
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Update selected template if initialTemplateId changes or when templates load
  useEffect(() => {
    if (initialTemplateId && safeTemplates.some(t => t.id === initialTemplateId)) {
      setSelectedTemplateId(initialTemplateId);
      try {
        const saved = sessionStorage.getItem('horeca_barista_auth_staff_id');
        if (saved) {
          setActiveStep('form');
        }
      } catch {}
    }
  }, [initialTemplateId, safeTemplates]);

  // Update selected point if initialPointId changes or when points load
  useEffect(() => {
    if (initialPointId && safePoints.some(p => p.id === initialPointId)) {
      setSelectedPointId(initialPointId);
    }
  }, [initialPointId, safePoints]);

  // Requirement: Strictly restrict available organizations to what the logged-in manager is permitted to access
  const allowedOrgs = useMemo<CompanyOrganization[]>(() => {
    const all = getOrganizations();
    if (!currentUser) {
      const active = getActiveOrganization();
      return active ? [active] : (all.length > 0 ? [all[0]] : []);
    }
    // Platform Super-Admin has oversight across all registered legal entities
    if (currentUser.role === 'app_admin') {
      return all;
    }
    // For managers (directors, unit managers, auditors, QC, etc.): strictly only their assigned organization(s)
    const userAllowed = getOrganizationsForUser(currentUser);
    if (userAllowed.length > 0) {
      return userAllowed;
    }
    // Defensive lookup by currentUser organizationId or INN
    if (currentUser.organizationId || currentUser.organizationInn) {
      const match = all.find(o => 
        (currentUser.organizationId && o.id === currentUser.organizationId) ||
        (currentUser.organizationInn && cleanInnString(o.inn) === cleanInnString(currentUser.organizationInn))
      );
      if (match) return [match];
    }
    const fallbackActive = getActiveOrganization();
    return fallbackActive ? [fallbackActive] : (all.length > 0 ? [all[0]] : []);
  }, [currentUser]);

  // Enforce registered organization strictly within allowedOrgs
  const [activeOrg, setActiveOrg] = useState<CompanyOrganization | null>(() => {
    const all = getOrganizations();
    if (currentUser && currentUser.role !== 'app_admin') {
      const userAllowed = getOrganizationsForUser(currentUser);
      if (userAllowed.length > 0) {
        const currActive = getActiveOrganization();
        const match = userAllowed.find(o => o.id === currActive?.id);
        return match || userAllowed[0];
      }
    }
    return getActiveOrganization() || all[0] || null;
  });

  // Automatically synchronize activeOrg to ensure it never points to an unauthorized legal entity
  useEffect(() => {
    if (allowedOrgs.length > 0) {
      const isCurrentActiveValid = activeOrg && allowedOrgs.some(o => o.id === activeOrg.id);
      if (!isCurrentActiveValid) {
        const target = allowedOrgs[0];
        setActiveOrg(target);
        setActiveOrganization(target.id);
      }
    }
  }, [currentUser, allowedOrgs, activeOrg?.id]);

  // Points and Staff filtered to the active legal entity
  const displayPoints = useMemo(() => {
    if (!activeOrg) return safePoints;
    const filtered = safePoints.filter(p => 
      !p.organizationId || p.organizationId === activeOrg.id || (activeOrg.inn && p.organizationInn === activeOrg.inn)
    );
    return filtered.length > 0 ? filtered : safePoints;
  }, [safePoints, activeOrg?.id, activeOrg?.inn]);

  const displayStaff = useMemo(() => {
    if (!activeOrg) return safeStaff;
    const filtered = safeStaff.filter(s => 
      !s.organizationId || s.organizationId === activeOrg.id || (activeOrg.inn && s.organizationInn === activeOrg.inn)
    );
    return filtered.length > 0 ? filtered : safeStaff;
  }, [safeStaff, activeOrg?.id, activeOrg?.inn]);

  // Keep selected point and staff synchronized with displayPoints and displayStaff
  useEffect(() => {
    if (displayPoints.length > 0 && !displayPoints.some(p => p.id === selectedPointId)) {
      setSelectedPointId(displayPoints[0].id);
    }
  }, [displayPoints, selectedPointId]);

  useEffect(() => {
    if (displayStaff.length > 0 && !displayStaff.some(s => s.id === selectedStaffId) && !authenticatedStaffId) {
      setSelectedStaffId(displayStaff[0].id);
    }
  }, [displayStaff, selectedStaffId, authenticatedStaffId]);

  const currentTemplate = safeTemplates.find(t => t.id === selectedTemplateId) || safeTemplates[0] || PREBUILT_TEMPLATES[0];
  const currentStaff = displayStaff.find(s => s.id === (authenticatedStaffId || selectedStaffId)) || displayStaff[0] || null;
  const currentPoint = displayPoints.find(p => p.id === selectedPointId) || displayPoints[0] || INITIAL_POINTS[0];

  // Requirement 3: Enforce registered organization and attached staff member
  const hasRegisteredOrganization = Boolean(
    activeOrg &&
    activeOrg.id &&
    activeOrg.name &&
    activeOrg.inn &&
    activeOrg.inn.trim().length >= 10 &&
    allowedOrgs.length > 0
  );

  // Check whether employee is assigned/attached to the current point
  const isStaffAttachedToPoint = Boolean(
    currentStaff &&
    currentPoint &&
    (
      (Array.isArray(currentStaff.pointIds) && currentStaff.pointIds.includes(currentPoint.id)) ||
      currentStaff.pointId === currentPoint.id
    )
  );

  // Checklist can ONLY be saved if BOTH registered organization AND attached staff member exist
  const canSaveChecklist = hasRegisteredOrganization && Boolean(currentStaff) && isStaffAttachedToPoint;

  // Initialize answers
  useEffect(() => {
    if (!currentTemplate) return;
    const initialAnswers: Record<string, Partial<BlockAnswer>> = {};
    currentTemplate.blocks.forEach(b => {
      if (b.type === 'heading' || b.type === 'divider') return;
      initialAnswers[b.id] = {
        blockId: b.id,
        blockTitle: b.title,
        type: b.type,
        value: b.type === 'check' ? false : b.type === 'select' ? (b.options?.[0]?.label || '') : '',
        photoUrls: [],
      };
    });
    setAnswers(initialAnswers);
    setValidationErrors([]);
  }, [currentTemplate?.id]);

  const handleUpdateAnswer = (blockId: string, updates: Partial<BlockAnswer>) => {
    setAnswers(prev => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        ...updates,
      }
    }));
  };

  const handlePhotoCaptured = (dataUrl: string) => {
    if (!activeCameraBlockId) return;

    // Simulate S3 upload
    const s3Item = uploadToS3(
      dataUrl,
      currentPoint?.name || 'Точка',
      'NEW_CHECK'
    );

    const existingUrls = answers[activeCameraBlockId]?.photoUrls || [];
    handleUpdateAnswer(activeCameraBlockId, {
      photoUrls: [...existingUrls, dataUrl],
      value: s3Item.shortUrl,
    });
    setActiveCameraBlockId(null);
  };

  // --- PIN Authentication Methods ---
  const onSuccessfulPin = (staff: StaffMember) => {
    setPinSuccess(true);
    setPinError(null);
    try {
      sessionStorage.setItem('horeca_barista_auth_staff_id', staff.id);
    } catch {}
    setTimeout(() => {
      setAuthenticatedStaffId(staff.id);
      setActiveStep('form');
      setPinSuccess(false);
      setPinInput('');
    }, 400);
  };

  const verifyPin = (pin: string) => {
    // 1. Check if any staff assigned to current point matches this PIN
    const assignedMatch = displayStaff.find(s => {
      const isAssigned = (Array.isArray(s.pointIds) && s.pointIds.includes(selectedPointId)) || s.pointId === selectedPointId;
      return isAssigned && s.pinCode === pin;
    });

    if (assignedMatch) {
      setSelectedStaffId(assignedMatch.id);
      onSuccessfulPin(assignedMatch);
      return;
    }

    // 2. Check if this PIN belongs to a staff member in this organization who is not assigned to this point
    const networkMatch = displayStaff.find(s => s.pinCode === pin);
    if (networkMatch) {
      setPinError(`Сотрудник ${networkMatch.name} не прикреплен к точке «${currentPoint?.name}»`);
      setTimeout(() => {
        setPinInput('');
      }, 1500);
      return;
    }

    // 3. Invalid PIN
    setPinError('Неверный PIN-код сотрудника. Попробуйте еще раз');
    setTimeout(() => {
      setPinInput('');
    }, 700);
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 4 || pinSuccess) return;
    const newPin = pinInput + digit;
    setPinInput(newPin);
    setPinError(null);

    if (newPin.length === 4) {
      verifyPin(newPin);
    }
  };

  const handlePinBackspace = () => {
    if (pinSuccess) return;
    setPinInput(prev => prev.slice(0, -1));
    setPinError(null);
  };

  const handleLockTerminal = () => {
    try {
      sessionStorage.removeItem('horeca_barista_auth_staff_id');
    } catch {}
    setAuthenticatedStaffId(null);
    setPinInput('');
    setPinError(null);
    setPinSuccess(false);
    setIsSubmitted(false);
    setActiveStep('auth');
  };

  const handleStartNewChecklist = () => {
    setIsSubmitted(false);
    setLastSubmissionResult(null);
    if (currentTemplate) {
      const initialAnswers: Record<string, Partial<BlockAnswer>> = {};
      currentTemplate.blocks.forEach(b => {
        if (b.type === 'heading' || b.type === 'divider') return;
        initialAnswers[b.id] = {
          blockId: b.id,
          blockTitle: b.title,
          type: b.type,
          value: b.type === 'check' ? false : b.type === 'select' ? (b.options?.[0]?.label || '') : '',
          photoUrls: [],
        };
      });
      setAnswers(initialAnswers);
    }
    setValidationErrors([]);
    setActiveStep('form');
  };

  // Keyboard listener for physical keypad / barcode scanner / desktop inputs
  useEffect(() => {
    if (activeStep !== 'auth') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        handlePinBackspace();
      } else if (e.key === 'Escape') {
        setPinInput('');
        setPinError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, pinInput, pinSuccess, selectedStaffId, selectedPointId]);

  // Validation before submission
  const validateForm = (): boolean => {
    if (!currentTemplate) return false;
    const errors: string[] = [];

    // Requirement 3: Strictly require a registered legal entity (IP / OOO)
    if (!hasRegisteredOrganization) {
      errors.push('Блокировка сохранения: В системе отсутствует зарегистрированная организация (ИП / ООО). Регистрация юр. лица обязательна для юридической фиксации актов чек-листов.');
    }

    // Requirement 3: Strictly require an attached staff member
    if (!currentStaff) {
      errors.push('Блокировка сохранения: Не определен сотрудник смены. Авторизуйтесь по PIN или выберите сотрудника.');
    } else if (!isStaffAttachedToPoint) {
      errors.push(`Блокировка сохранения: Сотрудник "${currentStaff.name}" не прикреплен к торговой точке "${currentPoint?.name}". Чек-лист может сохранять только привязанный к точке сотрудник сети.`);
    }

    currentTemplate.blocks.forEach(b => {
      if (b.type === 'heading' || b.type === 'divider') return;
      const ans = answers[b.id];

      if (b.required) {
        if (b.type === 'check' && ans?.value !== true) {
          errors.push(`Не отмечен обязательный пункт: "${b.title}"`);
        }
        if (b.type === 'photo' && (!ans?.photoUrls || ans.photoUrls.length === 0)) {
          errors.push(`Обязательно сделайте фото: "${b.title}"`);
        }
        if (b.type === 'number' && (ans?.value === undefined || ans?.value === null || ans?.value === '')) {
          errors.push(`Укажите значение замера: "${b.title}"`);
        }
      }

      if (b.photoRequired && (!ans?.photoUrls || ans.photoUrls.length === 0)) {
        errors.push(`Требуется подтверждающее фото для пункта: "${b.title}"`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSubmit = () => {
    if (submitting || isSubmitted) return;
    if (!canSaveChecklist) {
      validateForm();
      return;
    }
    if (!validateForm()) return;
    if (!currentTemplate || !currentPoint || !currentStaff || !activeOrg) return;

    setSubmitting(true);

    // Calculate time deviation from plan
    const now = new Date();
    let deviation = 0;
    if (currentTemplate.targetTime && typeof currentTemplate.targetTime === 'string' && currentTemplate.targetTime.includes(':')) {
      const [th, tm] = currentTemplate.targetTime.split(':').map(Number);
      const planDate = new Date();
      planDate.setHours(th, tm, 0, 0);
      deviation = Math.round((now.getTime() - planDate.getTime()) / (1000 * 60));
    }

    // Process answers and evaluate violations
    const finalAnswers: BlockAnswer[] = [];
    let violationsCount = 0;

    currentTemplate.blocks.forEach(b => {
      if (b.type === 'heading' || b.type === 'divider') return;
      const ans = answers[b.id];
      let isViolation = false;
      let violationReason = '';

      if (b.type === 'number' && typeof ans?.value === 'number') {
        if (b.minNumber !== undefined && ans.value < b.minNumber) {
          isViolation = true;
          violationReason = `Значение ниже нормы (${ans.value} ${b.unit || ''} < ${b.minNumber})`;
          violationsCount++;
        } else if (b.maxNumber !== undefined && ans.value > b.maxNumber) {
          isViolation = true;
          violationReason = `Значение выше нормы (${ans.value} ${b.unit || ''} > ${b.maxNumber})`;
          violationsCount++;
        }
      }

      finalAnswers.push({
        blockId: b.id,
        blockTitle: b.title,
        type: b.type,
        value: ans?.value ?? null,
        comment: ans?.comment || '',
        photoUrls: ans?.photoUrls || [],
        isViolation,
        violationReason,
      });
    });

    const status = violationsCount === 0 
      ? 'passed' 
      : violationsCount <= 2 
      ? 'warning' 
      : 'failed';

    const result = submitChecklist(
      {
        templateId: currentTemplate.id,
        templateTitle: currentTemplate.title,
        templateVersion: currentTemplate.version,
        pointId: currentPoint.id,
        pointName: currentPoint.name,
        organizationId: activeOrg.id,
        organizationName: activeOrg.name,
        organizationInn: activeOrg.inn,
        staffId: currentStaff.id,
        staffName: currentStaff.name,
        staffRole: currentStaff.role,
        timestamp: new Date().toISOString(),
        plannedTime: currentTemplate.targetTime,
        timeDeviationMinutes: deviation,
        answers: finalAnswers,
        totalItems: finalAnswers.length,
        completedItems: finalAnswers.length,
        violationsCount,
        status,
        s3MediaCount: finalAnswers.reduce((acc, a) => acc + (a.photoUrls?.length || 0), 0),
      },
      networkOnline
    );

    // Asynchronously send completed submission to real YDB
    if (result.submission && networkOnline) {
      saveSubmissionToYdb(result.submission).catch(err => {
        console.warn('YDB submission sync warning:', err);
      });
    }

    setTimeout(() => {
      setSubmitting(false);
      setIsSubmitted(true);
      setLastSubmissionResult(result);
      setActiveStep('success');
      onRefreshSubmissions();
    }, 600);
  };

  const actionableBlocks = currentTemplate?.blocks.filter(b => b.type !== 'heading' && b.type !== 'divider') || [];
  const completedCount = actionableBlocks.filter(b => {
    const a = answers[b.id];
    if (b.type === 'check') return a?.value === true;
    if (b.type === 'photo') return a?.photoUrls && a.photoUrls.length > 0;
    if (b.type === 'number') return a?.value !== '' && a?.value !== undefined && a?.value !== null;
    return !!a?.value;
  }).length;

  const progressPercent = actionableBlocks.length > 0 
    ? Math.round((completedCount / actionableBlocks.length) * 100) 
    : 0;

  return (
    <div className={`mx-auto w-full ${isStandaloneMobilePreview ? 'max-w-xl md:max-w-2xl lg:max-w-3xl h-[100dvh] flex flex-col p-0' : 'space-y-6'}`}>
      {/* Top Banner with Simulation Controls - only shown in Manager Dashboard tab, hidden in standalone linear staff view */}
      {!isStandaloneMobilePreview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Smartphone className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                PWA Мобильный Form Runner (Интерфейс Бариста)
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Мобильный терминал для линейного персонала сети. Заполнение смены, привязка к нескольким кофейням, фотофиксация и офлайн-синхронизация.
            </p>
          </div>

          {/* Quick Point, Staff & Organization switchers */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Registered Organization selector - strictly respects logged-in manager bindings */}
            {currentUser && currentUser.role !== 'app_admin' ? (
              allowedOrgs.length <= 1 ? (
                /* Attached Organization for logged-in manager (single legal entity locked - cannot pick foreign entities) */
                <div 
                  className="flex items-center space-x-1.5 text-xs px-2.5 py-1 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 rounded-lg text-slate-800 dark:text-slate-200 font-semibold max-w-[220px] truncate select-none shadow-xs"
                  title={`Юридическое лицо привязано к вашей учетной записи: ${allowedOrgs[0]?.name || activeOrg?.name || 'Организация'} (ИНН ${allowedOrgs[0]?.inn || activeOrg?.inn || ''})`}
                >
                  <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{allowedOrgs[0]?.name || activeOrg?.name || 'Организация'}</span>
                  <Lock className="w-3 h-3 text-amber-500/80 shrink-0" title="Привязано к профилю залогиненного управленца" />
                </div>
              ) : (
                /* Multi-entity selector for managers with multiple assigned legal entities */
                <div className="flex items-center space-x-1.5 text-xs">
                  <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <select
                    value={activeOrg?.id || allowedOrgs[0]?.id || ''}
                    onChange={(e) => {
                      const match = allowedOrgs.find(o => o.id === e.target.value);
                      if (match) {
                        setActiveOrganization(match.id);
                        setActiveOrg(match);
                      }
                    }}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[200px] truncate shadow-xs"
                    title="Выберите доступное юридическое лицо вашей сети"
                  >
                    {allowedOrgs.map(o => (
                      <option key={o.id} value={o.id}>
                        {o.name} (ИНН {o.inn})
                      </option>
                    ))}
                  </select>
                </div>
              )
            ) : currentUser?.role === 'app_admin' ? (
              /* Platform Super-Admin organization switcher */
              <div className="flex items-center space-x-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <select
                  value={activeOrg?.id || ''}
                  onChange={(e) => {
                    const match = allowedOrgs.find(o => o.id === e.target.value);
                    if (match) {
                      setActiveOrganization(match.id);
                      setActiveOrg(match);
                    }
                  }}
                  className="bg-slate-100 dark:bg-slate-800 border border-rose-400/40 dark:border-rose-500/30 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 max-w-[200px] truncate shadow-xs"
                  title="Супер-администратор: переключение между организациями платформы"
                >
                  {allowedOrgs.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name} (ИНН {o.inn})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/15 text-rose-400 rounded border border-rose-500/30 font-bold shrink-0">
                  Admin
                </span>
              </div>
            ) : (
              /* Unauthenticated / linear staff preview */
              <div 
                className="flex items-center space-x-1.5 text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold max-w-[210px] truncate shadow-xs"
                title={activeOrg ? `${activeOrg.name} (ИНН ${activeOrg.inn})` : 'Организация'}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{activeOrg?.name || 'Организация'}</span>
              </div>
            )}

            <div className="flex items-center space-x-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <select
                value={selectedPointId}
                onChange={(e) => {
                  const newPt = e.target.value;
                  setSelectedPointId(newPt);
                  // If current staff is not attached to this point, auto-select first attached staff if available
                  const match = displayStaff.find(s => 
                    (Array.isArray(s.pointIds) && s.pointIds.includes(newPt)) || s.pointId === newPt
                  );
                  if (match && !authenticatedStaffId) {
                    setSelectedStaffId(match.id);
                  }
                }}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                {displayPoints.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 text-xs">
              <User className="w-3.5 h-3.5 text-sky-500 shrink-0" />
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                title="Сотрудник сети (зеленая отметка - привязан к текущей точке)"
              >
                {displayStaff.map(s => {
                  const isAssigned = (Array.isArray(s.pointIds) && s.pointIds.includes(selectedPointId)) || s.pointId === selectedPointId;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role}) {isAssigned ? '✓ привязан' : '⚠️ не привязан'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Responsive Mobile / Tablet Terminal Card (Full viewport fit) */}
      <div className={`w-full max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden relative transition-all ${
        isStandaloneMobilePreview
          ? 'h-[100dvh] max-h-[100dvh] rounded-none sm:rounded-3xl border-0 sm:border sm:border-slate-800'
          : 'h-[calc(100dvh-7.5rem)] min-h-[640px] max-h-[880px] rounded-3xl border border-slate-200/90 dark:border-slate-800'
      }`}>
        {/* Terminal Top Info Bar (Fixed) */}
        <div className="bg-slate-900 text-white px-3.5 sm:px-5 py-2.5 flex items-center justify-between border-b border-slate-800 text-xs shrink-0 z-20 select-none">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="font-bold tracking-tight text-white text-xs sm:text-sm truncate">
              Терминал бариста • {currentPoint?.name}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono hidden md:inline-block shrink-0">
              {currentPoint?.code || 'ТТ'}
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs shrink-0">
            {networkOnline ? (
              <span className="inline-flex items-center space-x-1 text-emerald-400 text-[11px]">
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Онлайн</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 text-rose-400 text-[11px]">
                <WifiOff className="w-3.5 h-3.5" />
                <span>Офлайн</span>
              </span>
            )}
            <span className="text-slate-600 dark:text-slate-500 hidden sm:inline">|</span>
            <span className="text-slate-300 text-[11px] font-mono hidden sm:inline">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isStandaloneMobilePreview && (
              currentUser ? (
                <button
                  type="button"
                  onClick={onSwitchToManagerPanel}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold border border-slate-700 transition"
                  title="Панель управления"
                >
                  В панель
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLoginModal}
                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold transition flex items-center space-x-1"
                  title="Вход для управляющего"
                >
                  <Lock className="w-3 h-3" />
                  <span className="hidden xs:inline">Управляющий</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Offline Status Banner */}
        {!networkOnline && (
          <div className="bg-rose-500 text-white px-3 py-1.5 text-[11px] font-semibold flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-1.5">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Офлайн режим (сохранится на телефоне)</span>
            </div>
            <span className="text-[10px] bg-rose-700 px-1.5 py-0.5 rounded font-mono">
              LocalStorage
            </span>
          </div>
        )}

        {/* Step: Staff PIN Authentication Screen */}
        {activeStep === 'auth' && (
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 flex flex-col justify-center items-center max-w-sm mx-auto w-full animate-in fade-in">
            <div className="w-full text-center space-y-3 my-auto">
              {/* Icon & Title */}
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25">
                <Key className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Авторизация смены
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {currentPoint?.name} • <span className="font-mono">{currentPoint?.code}</span>
                </p>
              </div>

              {/* Point info card */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                      {currentPoint?.name}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono text-slate-500 dark:text-slate-400 shrink-0">
                    {currentPoint?.code}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center space-x-1">
                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                  <span>Введите ваш 4-значный PIN-код для открытия смены</span>
                </p>
              </div>

              {/* PIN Dots Indicator */}
              <div className="pt-2">
                <div className="flex items-center justify-center space-x-4 my-2">
                  {[0, 1, 2, 3].map(i => {
                    const filled = pinInput.length > i;
                    return (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                          pinSuccess
                            ? 'bg-emerald-500 scale-125 ring-4 ring-emerald-500/20'
                            : pinError
                            ? 'bg-rose-500 scale-110 ring-4 ring-rose-500/20 animate-pulse'
                            : filled
                            ? 'bg-amber-500 scale-125 ring-4 ring-amber-500/25'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    );
                  })}
                </div>

                {pinError ? (
                  <p className="text-rose-500 text-xs font-semibold animate-in fade-in">
                    {pinError}
                  </p>
                ) : pinSuccess ? (
                  <p className="text-emerald-500 text-xs font-semibold animate-in fade-in flex items-center justify-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>PIN подтвержден! Вход на смену...</span>
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs">
                    Введите 4-значный PIN-код сотрудника
                  </p>
                )}
              </div>

              {/* Tactile Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinDigit(num)}
                    className="h-12 sm:h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95 text-slate-900 dark:text-white font-black text-xl transition-all shadow-xs flex items-center justify-center"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError(null);
                  }}
                  className="h-12 sm:h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95 text-slate-500 dark:text-slate-400 font-bold text-sm transition-all shadow-xs flex items-center justify-center"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigit('0')}
                  className="h-12 sm:h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95 text-slate-900 dark:text-white font-black text-xl transition-all shadow-xs flex items-center justify-center"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-12 sm:h-13 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 active:scale-95 text-slate-500 dark:text-slate-400 font-bold text-sm transition-all shadow-xs flex items-center justify-center"
                  title="Удалить цифру"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

            {/* Step: Success screen - Blocking Splash Screen against duplicate submission */}
            {activeStep === 'success' && lastSubmissionResult && (
              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between items-center text-center animate-in fade-in zoom-in-95 overflow-y-auto">
                <div className="my-auto space-y-4 max-w-sm w-full">
                  <div className="relative mx-auto w-20 h-20">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 text-emerald-500 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                      <CheckCircle2 className="w-11 h-11" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-white dark:border-slate-900" title="Форма заблокирована от повторной отправки">
                      <Lock className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-mono border border-amber-500/30">
                      {lastSubmissionResult.submission.number1C}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5">
                      Чек-лист успешно отправлен!
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {currentPoint?.name} • Бариста: {currentStaff?.name}
                    </p>
                  </div>

                  {/* Anti-Duplicate Security Banner */}
                  <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 text-left flex items-start space-x-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-amber-800 dark:text-amber-200 leading-tight">
                      <strong className="font-bold">Блокировка повторной отправки активна:</strong> отчет зарегистрирован в YDB/1C. Повторная отправка тех же данных заблокирована во избежание дублирования.
                    </div>
                  </div>

                  {/* Summary Card */}
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2 shadow-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Статус записи:</span>
                      <span className="font-bold text-emerald-500 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{lastSubmissionResult.queued ? 'В очереди передачи (PWA)' : 'Записано в YDB Serverless'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Номер документа 1С:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {lastSubmissionResult.submission.number1C}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Юр. лицо:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[170px]" title={lastSubmissionResult.submission.organizationName || activeOrg.name}>
                        {lastSubmissionResult.submission.organizationName || activeOrg.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">ИНН организации:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {lastSubmissionResult.submission.organizationInn || activeOrg.inn}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Привязанный сотрудник:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{lastSubmissionResult.submission.staffName} ({lastSubmissionResult.submission.staffRole})</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Загружено фото в MinIO:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {lastSubmissionResult.submission.s3MediaCount} фото
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Нарушений стандартов:</span>
                      <span className={`font-bold ${lastSubmissionResult.submission.violationsCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                        {lastSubmissionResult.submission.violationsCount > 0 
                          ? `${lastSubmissionResult.submission.violationsCount} замечаний` 
                          : '0 (В пределах нормы)'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-2 pt-4">
                  <button
                    type="button"
                    onClick={() => onViewInspectionDoc(lastSubmissionResult.submission.number1C)}
                    className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-xs"
                  >
                    <span>Открыть протокол проверки (1С)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleLockTerminal}
                    className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center space-x-1.5 transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Завершить работу и заблокировать терминал</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStartNewChecklist}
                    className="w-full py-2.5 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold text-xs transition"
                  >
                    Начать новую проверку смены (Новый бланк)
                  </button>
                </div>
              </div>
            )}

            {/* Step: Form Filling */}
            {activeStep === 'form' && currentTemplate && (
              <>
                {/* Form Top Bar (Locked identity, no unauthorized switching) */}
                <div className="px-3.5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-sm shrink-0">
                        ☕
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate max-w-[150px] sm:max-w-xs md:max-w-md">
                          {currentTemplate?.title || 'Чек-лист смены'}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[110px] sm:max-w-[180px]">
                            {currentPoint?.name}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center space-x-1 text-slate-600 dark:text-slate-300 font-medium truncate max-w-[90px] sm:max-w-[120px]">
                            <UserCheck className="w-3 h-3 text-emerald-500 shrink-0 inline" />
                            <span>{currentStaff?.name || 'Бариста'}</span>
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleLockTerminal}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center space-x-1 transition"
                        title="Заблокировать терминал / Сменить сотрудника (требуется PIN)"
                      >
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span className="hidden xs:inline">Сменить</span>
                      </button>

                      <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        {progressPercent}%
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Validation Errors Box (Fixed banner) */}
                {validationErrors.length > 0 && (
                  <div className="mx-3.5 mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] space-y-1 shrink-0 z-10 animate-in fade-in">
                    <div className="font-bold flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Пожалуйста, заполните обязательные пункты:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                      {validationErrors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Scrollable Questions List (Fixed header above, fixed submit below) */}
                <div className="p-3.5 flex-1 overflow-y-auto overscroll-contain space-y-3">
                  {/* Requirement 3: Legal Entity & Attached Staff Verification Card */}
                  <div className={`p-3 rounded-2xl border text-xs space-y-2 transition ${
                    canSaveChecklist
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <Building2 className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                            Юридическое лицо
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {hasRegisteredOrganization ? activeOrg.name : 'Организация не зарегистрирована'}
                          </p>
                        </div>
                      </div>
                      {hasRegisteredOrganization ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>ИНН {activeOrg.inn}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold text-[10px] shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Не зарегистрировано</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-200/60 dark:border-slate-800/60 pt-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <UserCheck className="w-4 h-4 text-sky-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                            Ответственный сотрудник
                          </p>
                          <p className="font-bold text-slate-900 dark:text-white truncate">
                            {currentStaff ? `${currentStaff.name} (${currentStaff.role})` : 'Сотрудник не выбран'}
                          </p>
                        </div>
                      </div>
                      {isStaffAttachedToPoint ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Привязан к точке</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold text-[10px] shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Не привязан к точке</span>
                        </span>
                      )}
                    </div>

                    {!canSaveChecklist && (
                      <div className="flex items-start space-x-1.5 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-medium leading-tight">
                        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          {!hasRegisteredOrganization
                            ? 'Сохранение заблокировано: зарегистрируйте ИП/ООО в личном кабинете юр. лица.'
                            : !currentStaff
                            ? 'Сохранение заблокировано: выберите сотрудника смены.'
                            : 'Сохранение заблокировано: сотрудник не прикреплен к этой торговой точке.'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Template Template Picker if needed */}
                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Выбрать чек-лист:</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 text-xs font-semibold"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.title} ({t.code})</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Blocks */}
                  {currentTemplate.blocks.map((block) => {
                    const ans = answers[block.id];
                    const isHeading = block.type === 'heading';
                    const isDivider = block.type === 'divider';

                    if (isHeading) {
                      return (
                        <div key={block.id} className="pt-2 pb-1">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>{block.title}</span>
                          </h4>
                        </div>
                      );
                    }

                    if (isDivider) {
                      return <hr key={block.id} className="border-slate-200 dark:border-slate-800 my-1" />;
                    }

                    // Number validation status
                    const numValue = typeof ans?.value === 'number' ? ans.value : null;
                    const isNumberViolation = block.type === 'number' && numValue !== null && (
                      (block.minNumber !== undefined && numValue < block.minNumber) ||
                      (block.maxNumber !== undefined && numValue > block.maxNumber)
                    );

                    return (
                      <div
                        key={block.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isNumberViolation
                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-400 dark:border-rose-800'
                            : 'bg-white dark:bg-slate-850 border-slate-200/80 dark:border-slate-800 shadow-2xs'
                        }`}
                      >
                        {/* Title and Required Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white leading-tight">
                                {block.title}
                              </span>
                              {block.required && (
                                <span className="text-rose-500 font-black text-xs">*</span>
                              )}
                            </div>
                            {block.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                                {block.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Control Render */}
                        <div className="mt-2.5">
                          {/* CHECKBOX */}
                          {block.type === 'check' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateAnswer(block.id, { value: !ans?.value })}
                              className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-semibold transition ${
                                ans?.value
                                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              <span>{ans?.value ? 'Выполнено / Соответствует' : 'Нажмите, чтобы отметить'}</span>
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition ${
                                ans?.value ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-black' : 'border-slate-400'
                              }`}>
                                {ans?.value && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          )}

                          {/* PHOTO BLOCK OR PHOTO REQUIRED */}
                          {(block.type === 'photo' || block.photoRequired) && (
                            <div className="mt-2 space-y-2">
                              {/* Photo Thumbnails list */}
                              {ans?.photoUrls && ans.photoUrls.length > 0 ? (
                                <div className="flex flex-wrap gap-2 items-center">
                                  {ans.photoUrls.map((url, pIdx) => (
                                    <div key={pIdx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 group">
                                      <img src={url} alt="Снимок" className="w-full h-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newUrls = ans.photoUrls?.filter((_, i) => i !== pIdx);
                                          handleUpdateAnswer(block.id, { photoUrls: newUrls, value: newUrls?.[0] || '' });
                                        }}
                                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => setActiveCameraBlockId(block.id)}
                                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 hover:text-amber-500 hover:border-amber-500 transition text-[10px]"
                                  >
                                    <Camera className="w-4 h-4 mb-1" />
                                    <span>Еще фото</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveCameraBlockId(block.id)}
                                  className="w-full py-2.5 px-3 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center space-x-2 transition"
                                >
                                  <Camera className="w-4 h-4" />
                                  <span>Сделать фото с камеры (S3)</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* NUMBER INPUT */}
                          {block.type === 'number' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  value={ans?.value !== undefined ? (ans.value as number) : ''}
                                  onChange={(e) => {
                                    const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                    handleUpdateAnswer(block.id, { value: val });
                                  }}
                                  placeholder={`Норма: ${block.minNumber ?? '-'} ... ${block.maxNumber ?? '-'}`}
                                  className={`flex-1 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl text-xs font-mono font-bold border transition ${
                                    isNumberViolation
                                      ? 'border-rose-500 text-rose-600 dark:text-rose-400 bg-rose-50'
                                      : 'border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                                  }`}
                                />
                                {block.unit && (
                                  <span className="font-bold text-xs text-slate-500 px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    {block.unit}
                                  </span>
                                )}
                              </div>

                              {isNumberViolation && (
                                <div className="text-[10px] text-rose-500 font-bold flex items-center space-x-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Отклонение от нормы ХАССП ({block.minNumber} - {block.maxNumber} {block.unit})!</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* SELECT OPTIONS */}
                          {block.type === 'select' && block.options && (
                            <select
                              value={ans?.value as string || ''}
                              onChange={(e) => handleUpdateAnswer(block.id, { value: e.target.value })}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white"
                            >
                              {block.options.map(opt => (
                                <option key={opt.id} value={opt.label}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* TEXT COMMENT */}
                          {block.type === 'text' && (
                            <textarea
                              rows={2}
                              value={ans?.value as string || ''}
                              onChange={(e) => handleUpdateAnswer(block.id, { value: e.target.value })}
                              placeholder="Текст комментария бариста..."
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white resize-none"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit Action Bar (Fixed at bottom, always visible) */}
                <div className="p-3.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shrink-0 sticky bottom-0 z-20 shadow-lg">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || isSubmitted || !canSaveChecklist}
                    className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 transition ${
                      !canSaveChecklist
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none border border-slate-300 dark:border-slate-700'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/25 disabled:opacity-50'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Синхронизация с YDB & MinIO...</span>
                      </>
                    ) : isSubmitted ? (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>Отчет уже отправлен и заблокирован</span>
                      </>
                    ) : !canSaveChecklist ? (
                      <>
                        <Lock className="w-4 h-4 text-amber-500" />
                        <span>
                          {!hasRegisteredOrganization
                            ? 'Требуется регистрация юр. лица'
                            : !currentStaff
                            ? 'Сотрудник не выбран'
                            : 'Сотрудник не привязан к точке'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>Отправить отчет ({completedCount}/{actionableBlocks.length})</span>
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            {activeStep === 'form' && !currentTemplate && (
              <div className="p-8 text-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto animate-spin">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Подготовка чек-листа...</h4>
                <p className="text-xs text-slate-500">Загрузка параметров и пунктов стандарта смены</p>
              </div>
            )}
      </div>

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={!!activeCameraBlockId}
        onClose={() => setActiveCameraBlockId(null)}
        onCapture={handlePhotoCaptured}
        title={currentTemplate?.blocks.find(b => b.id === activeCameraBlockId)?.title || 'Фотоотчет'}
        pointName={currentPoint?.name || 'Точка'}
        staffName={currentStaff?.name || 'Бариста'}
        cameraOnly={currentTemplate?.blocks.find(b => b.id === activeCameraBlockId)?.cameraOnly}
      />
    </div>
  );
};
