import React from 'react';
import { MergedData } from '../types';
import { X, Printer, ArrowRight, AlertCircle } from 'lucide-react';

interface MoveReportProps {
    data: MergedData[];
    onClose: () => void;
    onSelectMove: (itemId: string, targetId: string) => void;
}

export const MoveReport: React.FC<MoveReportProps> = ({ data, onClose, onSelectMove }) => {
    // Filtra itens que têm sugestão de movimento
    const moves = data
        .filter(d => d.moveSuggestion)
        .map(d => d.moveSuggestion!)
        .sort((a, b) => a.curve.localeCompare(b.curve)); // P primeiro, depois Q, etc

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 w-full max-w-4xl h-[90vh] rounded-xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <AlertCircle className="text-orange-500"/> Relatório de Sugestões de Movimentação
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Baseado na Curva PQR e Otimização de Setor</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold flex items-center gap-2 transition-colors">
                            <Printer size={16}/> Imprimir
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                            <X size={24}/>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-slate-900 print:bg-white print:text-black">
                    {moves.length === 0 ? (
                        <div className="text-center text-slate-500 py-10">
                            Nenhuma sugestão de movimentação encontrada para o cenário atual.
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase">
                                    <th className="p-3">Curva</th>
                                    <th className="p-3">Produto</th>
                                    <th className="p-3">Origem (Atual)</th>
                                    <th className="p-3 text-center"></th>
                                    <th className="p-3">Destino (Sugerido)</th>
                                    <th className="p-3">Motivo</th>
                                    <th className="p-3 print:hidden">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {moves.map((move, i) => (
                                    <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors text-sm text-slate-300">
                                        <td className="p-3">
                                            <span className={`font-bold px-2 py-0.5 rounded ${move.curve === 'P' ? 'bg-red-500/20 text-red-400' : move.curve === 'Q' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {move.curve}
                                            </span>
                                        </td>
                                        <td className="p-3 font-medium text-white">{move.productName} <span className="text-xs text-slate-500 block">{move.itemId}</span></td>
                                        <td className="p-3 font-mono">{move.currentAddressId}</td>
                                        <td className="p-3 text-center"><ArrowRight size={16} className="text-slate-600 inline"/></td>
                                        <td className="p-3 font-mono font-bold text-cyan-400">{move.suggestedAddressId}</td>
                                        <td className="p-3 text-xs italic text-slate-500">{move.reason}</td>
                                        <td className="p-3 print:hidden">
                                            <button 
                                                onClick={() => onSelectMove(move.currentAddressId, move.suggestedAddressId)}
                                                className="text-[10px] px-2 py-1 border border-cyan-500 text-cyan-500 rounded hover:bg-cyan-500 hover:text-white transition-all uppercase"
                                            >
                                                Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
