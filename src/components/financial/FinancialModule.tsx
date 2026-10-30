import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentRecord, ExpenseRecord } from '../../types';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Plus,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import { calculateFinancialSummary } from '../../utils/rules';

export const FinancialModule: React.FC = () => {
  const {
    payments,
    expenses,
    patients,
    addPayment,
    updatePaymentStatus,
    addExpense,
    currentUser
  } = useApp();

  const [activeTab, setActiveTab] = useState<'revenues' | 'expenses'>('revenues');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // New Payment Form
  const [payPatientId, setPayPatientId] = useState('');
  const [payAmount, setPayAmount] = useState(190);
  const [payMethod, setPayMethod] = useState<'pix' | 'cash' | 'card' | 'transfer'>('pix');
  const [payStatus, setPayStatus] = useState<'paid' | 'pending' | 'overdue'>('paid');
  const [payDueDate, setPayDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [payDescription, setPayDescription] = useState('Sessão de Psicoterapia Individual');

  // New Expense Form
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<'rent' | 'software' | 'materials' | 'marketing' | 'taxes' | 'other'>('rent');
  const [expAmount, setExpAmount] = useState(100);
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid');
  const [expMethod, setExpMethod] = useState('Pix');

  const summary = calculateFinancialSummary(payments, expenses);

  const filteredPayments = payments.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === payPatientId);
    if (!patient) {
      alert('Selecione um paciente');
      return;
    }

    addPayment({
      psychologistId: currentUser.uid,
      patientId: patient.id,
      patientName: patient.name,
      amount: Number(payAmount),
      method: payMethod,
      status: payStatus,
      dueDate: payDueDate,
      paidAt: payStatus === 'paid' ? new Date().toISOString() : undefined,
      description: payDescription
    });

    setShowPaymentModal(false);
  };

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle.trim()) return;

    addExpense({
      psychologistId: currentUser.uid,
      title: expTitle,
      category: expCategory,
      amount: Number(expAmount),
      date: expDate,
      status: expStatus,
      paymentMethod: expMethod
    });

    setShowExpenseModal(false);
    setExpTitle('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Módulo Financeiro do Consultório</h1>
          <p className="text-xs text-slate-500">
            Controle de honorários, pagamentos (Pix, Cartão, Dinheiro), inadimplência e despesas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-slate-500" />
            <span>Lançar Despesa</span>
          </button>

          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Recebimento</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-medium block mb-1">Total Recebido</span>
          <p className="text-xl font-bold text-emerald-700">
            R$ {summary.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium">Honorários quitados</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-medium block mb-1">A Receber</span>
          <p className="text-xl font-bold text-amber-600">
            R$ {summary.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-amber-700 font-medium">No prazo</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-medium block mb-1">Inadimplência</span>
          <p className="text-xl font-bold text-rose-600">
            R$ {summary.totalOverdue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-rose-600 font-medium">Vencidos sem quitação</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-slate-500 text-xs font-medium block mb-1">Despesas Pagas</span>
          <p className="text-xl font-bold text-slate-800">
            R$ {summary.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">Consultório e softwares</span>
        </div>

        <div className="bg-gradient-to-tr from-teal-700 to-emerald-600 text-white p-4 rounded-xl shadow-xs">
          <span className="text-teal-100 text-xs font-medium block mb-1">Saldo Líquido</span>
          <p className="text-xl font-bold">
            R$ {summary.netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-teal-100">Resultado do período</span>
        </div>
      </div>

      {/* Navigation tabs & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('revenues')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'revenues' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
            >
              Recebimentos de Sessões ({payments.length})
            </button>
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${activeTab === 'expenses' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600'}`}
            >
              Despesas Operacionais ({expenses.length})
            </button>
          </div>

          {activeTab === 'revenues' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Filtrar status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700"
              >
                <option value="all">Todos</option>
                <option value="paid">Pagos</option>
                <option value="pending">Pendentes</option>
                <option value="overdue">Vencidos</option>
              </select>
            </div>
          )}
        </div>

        {/* Revenues Table */}
        {activeTab === 'revenues' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Paciente</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map(pay => (
                  <tr key={pay.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{pay.patientName}</td>
                    <td className="py-3 px-4 text-slate-600">{pay.description}</td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {pay.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{pay.dueDate.split('-').reverse().join('/')}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">R$ {pay.amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
                        pay.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        pay.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {pay.status === 'paid' && 'Pago'}
                        {pay.status === 'pending' && 'Pendente'}
                        {pay.status === 'overdue' && 'Vencido'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {pay.status !== 'paid' ? (
                        <button
                          onClick={() => updatePaymentStatus(pay.id, 'paid')}
                          className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-700 font-semibold text-[11px] transition-colors"
                        >
                          Marcar Pago
                        </button>
                      ) : (
                        <span className="text-[11px] text-emerald-600 font-medium">✓ Liquidado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Expenses Table */}
        {activeTab === 'expenses' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Despesa</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Forma de Pagamento</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{exp.title}</td>
                    <td className="py-3 px-4 text-slate-600 capitalize">{exp.category}</td>
                    <td className="py-3 px-4 text-slate-600">{exp.paymentMethod || 'Pix'}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{exp.date.split('-').reverse().join('/')}</td>
                    <td className="py-3 px-4 font-mono font-bold text-rose-700">R$ {exp.amount.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        exp.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {exp.status === 'paid' ? 'Pago' : 'A Pagar'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Registrar Recebimento de Consulta</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paciente *</label>
                <select
                  required
                  value={payPatientId}
                  onChange={(e) => setPayPatientId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">-- Selecione o Paciente --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="pix">Pix</option>
                    <option value="card">Cartão de Crédito/Débito</option>
                    <option value="cash">Dinheiro em Espécie</option>
                    <option value="transfer">Transferência Bancária</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    required
                    value={payDueDate}
                    onChange={(e) => setPayDueDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="paid">Já Pago / Liquidado</option>
                    <option value="pending">Pendente de Pagamento</option>
                    <option value="overdue">Vencido / Inadimplente</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={payDescription}
                  onChange={(e) => setPayDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  Salvar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Lançar Despesa Operacional</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-slate-400 font-bold">✕</button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descrição da Despesa *</label>
                <input
                  type="text"
                  required
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="Ex: Aluguel da sublocação, Papelaria, etc."
                  className="w-full p-2.5 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="rent">Locação / Consultório</option>
                    <option value="software">Softwares & Sistemas</option>
                    <option value="materials">Materiais & Testes Psicológicos</option>
                    <option value="marketing">Marketing & Divulgação</option>
                    <option value="taxes">Impostos & CRP</option>
                    <option value="other">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={expAmount}
                    onChange={(e) => setExpAmount(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={expStatus}
                    onChange={(e) => setExpStatus(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50"
                  >
                    <option value="paid">Pago</option>
                    <option value="pending">A Pagar</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold"
                >
                  Salvar Despesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
