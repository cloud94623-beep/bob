import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

// SVG 컴포넌트 모음
const SunSVG = () => (
  <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.757 17.834a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
  </svg>
);
const MoonSVG = () => (
  <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
  </svg>
);
const ForkKnifeSVG = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-12 h-12 text-[#e5e5e5]">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v7M6 2v7M10 2v7M8 9v13M17 2v20M17 2c-3 0-3 4-3 7s3 3 3 3" />
  </svg>
);

const getDaysInMonthArray = (year, month) => {
  const totalDays = new Date(year, month, 0).getDate();
  return Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
};
const getMonthStartOffsetGap = (year, month) => new Date(year, month - 1, 1).getDay();

const safeParseObj = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || null;
  } catch(e) { return null; }
};

export default function App() {
  // 🚀 글로벌 공유 데이터 (Firestore에서 실시간으로 가져옴)
  const [usersDatabase, setUsersDatabase] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [mySchedules, setMySchedules] = useState([]);
  const [devReservations, setDevReservations] = useState([]);

  const [currentUser, setCurrentUser] = useState(() => safeParseObj('bmz_session_v24'));
  const [view, setView] = useState(currentUser ? 'dashboard' : 'login');
  
  const [loginName, setLoginName] = useState('');
  const [loginBirth, setLoginBirth] = useState('');

  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [newRoomTimeType, setNewRoomTimeType] = useState('lunch'); 
  const [tempRoomData, setTempRoomData] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [creatorInitialOpinion, setCreatorFirstOpinion] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  
  const [joinCode, setJoinCode] = useState('BMZ-');
  const [scheduleTab, setScheduleTab] = useState('input');
  const [inputSelectedDates, setInputSelectedDates] = useState([]); 
  const [checkSingleDate, setCheckSelectedDate] = useState(''); 
  const [guestOpinion, setGuestOpinion] = useState('');
  
  const [myCalSelectedDate, setMyCalSelectedDate] = useState('');
  const [myCalMemo, setMyCalMemo] = useState('');
  const [myCalTimeType, setMyCalTimeType] = useState('lunch'); 

  const [devSelectedDate, setDevSelectedDate] = useState('');
  const [devBlockMemo, setDevBlockMemo] = useState('');
  const [devTimeType, setDevTimeType] = useState('lunch'); 
  
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(6);
  const [toastMessage, setToastMessage] = useState('');
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);
  const [showUserList, setShowUserList] = useState(false);

  const isDeveloper = currentUser?.id === '개발자#4475';

  // 내 로그인 정보는 로컬에 유지
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('bmz_session_v24', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('bmz_session_v24');
    }
  }, [currentUser]);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // 🚀 파이어베이스 실시간 수신 (무한 로딩 방지 및 에러 팝업 추가)
  useEffect(() => {
    // 1. 사용자 컬렉션
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsersDatabase(data);
    }, (error) => {
      console.error("Users 에러:", error);
      triggerToast("Users 데이터 로드 실패: " + error.code);
    });

    // 2. 방(Rooms) 컬렉션
    const unsubRooms = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(data);
    }, (error) => {
      console.error("Rooms 에러:", error);
      triggerToast("Rooms 데이터 로드 실패: " + error.code);
    });

    // 3. 내 일정(Schedules) 컬렉션
    const unsubSchedules = onSnapshot(collection(db, "schedules"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMySchedules(data);
    }, (error) => {
      console.error("Schedules 에러:", error);
      triggerToast("일정 데이터 로드 실패: " + error.code);
    });

    // 4. 개발자 예약(dev예약) 컬렉션
    const unsubDev = onSnapshot(collection(db, "devReservations"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDevReservations(data);
    }, (error) => {
      console.error("DevReservations 에러:", error);
      triggerToast("예약 데이터 로드 실패: " + error.code);
    });

    return () => { unsubUsers(); unsubRooms(); unsubSchedules(); unsubDev(); };
  }, []);

  // 🚀 Firestore 데이터 저장/업데이트/삭제 도우미 함수 (에러 상세 표시)
  const saveToDb = async (collectionName, docId, data) => {
    try {
      await setDoc(doc(db, collectionName, docId), data);
    } catch (e) {
      console.error("Error saving document: ", e);
      triggerToast(`저장 실패 (${collectionName}): ` + e.code);
    }
  };

  const deleteFromDb = async (collectionName, docId) => {
    try {
      await deleteDoc(doc(db, collectionName, docId));
    } catch (e) {
      console.error("Error deleting document: ", e);
      triggerToast(`삭제 실패 (${collectionName}): ` + e.code);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const trimName = loginName.trim();
    const trimBirth = loginBirth.trim();
    if(!trimName || trimBirth.length !== 4) return triggerToast("이름과 생일 4자리를 입력해주세요.");

    const userId = `${trimName}#${trimBirth}`;
    const existingUser = usersDatabase.find(u => u.name === trimName);
    
    if (existingUser && existingUser.birth !== trimBirth) {
        return triggerToast("비밀번호가 틀렸습니다.");
    }

    if (!existingUser) {
      // 신규 유저 DB 저장 (users 컬렉션)
      saveToDb("users", userId, { id: userId, name: trimName, birth: trimBirth });
    }
    setCurrentUser({ id: userId, name: trimName, birth: trimBirth });
    setView('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
  };

  const handleCreateRoomSubmit = (e) => {
    e.preventDefault();
    if (!newRoomTitle.trim()) return triggerToast("모임 이름을 입력하세요.");
    setTempRoomData({ title: newRoomTitle, timeType: newRoomTimeType });
    setSelectedDates([]);
    setView('select-dates');
  };

  const handleFinalizeRoom = () => {
    if (selectedDates.length === 0) return triggerToast("날짜를 최소 하나 선택하세요.");
    const newCode = 'BMZ-' + Math.floor(1000 + Math.random() * 9000);
    const finalTitle = `[${tempRoomData.timeType === 'lunch' ? '점심' : '저녁'}] ${tempRoomData.title}`;
    
    const newRoom = {
      id: newCode, title: finalTitle, timeType: tempRoomData.timeType,
      creatorId: currentUser.id, dates: selectedDates, fixedDate: null,
      participants: [{ id: currentUser.id, name: currentUser.name, dates: selectedDates, comment: creatorInitialOpinion || "없음" }]
    };
    
    saveToDb("rooms", newCode, newRoom); // DB 저장
    
    setCreatedRoomCode(newCode);
    setView('room-success');
    setNewRoomTitle(''); setCreatorFirstOpinion('');
  };

  const handleJoinCodeChange = (e) => {
    let val = e.target.value.toUpperCase();
    if (!val.startsWith('BMZ-')) val = 'BMZ-' + val.replace(/BMZ-/g, '');
    setJoinCode(val);
  };

  const handleJoinRoomSubmit = (e) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    const targetRoom = rooms.find(r => r.id === cleanCode);
    
    if (!targetRoom) return triggerToast("존재하지 않는 코드입니다.");
    
    if (!targetRoom.participants.some(p => p.id === currentUser.id)) {
      const updatedParticipants = [...targetRoom.participants, { id: currentUser.id, name: currentUser.name, dates: [], comment: "없음" }];
      saveToDb("rooms", targetRoom.id, { ...targetRoom, participants: updatedParticipants }); // DB 업데이트
      setInputSelectedDates([]); 
    } else {
        setInputSelectedDates(targetRoom.participants.find(p => p.id === currentUser.id)?.dates || []);
    }
    
    setSelectedRoomId(targetRoom.id);
    setScheduleTab('input');
    setView('view-schedule');
    setJoinCode('BMZ-');
  };

  const handleGuestJoinSubmit = () => {
    if ((inputSelectedDates || []).length === 0) return triggerToast("날짜를 선택해주세요.");
    
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    if(targetRoom) {
      const existingIdx = targetRoom.participants.findIndex(p => p.id === currentUser.id);
      let newParts = [...targetRoom.participants];
      if (existingIdx > -1) newParts[existingIdx] = { ...newParts[existingIdx], dates: inputSelectedDates || [], comment: guestOpinion || "없음" };
      else newParts.push({ id: currentUser.id, name: currentUser.name, dates: inputSelectedDates || [], comment: guestOpinion || "없음" });
      
      saveToDb("rooms", targetRoom.id, { ...targetRoom, participants: newParts }); // DB 업데이트
    }
    
    setGuestOpinion('');
    triggerToast("내 일정이 업데이트 되었습니다.");
  };

  const handleFixSchedule = (dateStr) => {
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    saveToDb("rooms", targetRoom.id, { ...targetRoom, fixedDate: dateStr });
    triggerToast(`[${dateStr}] 일정이 최종 확정되었습니다!`);
  };

  const handleCancelFix = () => {
    const targetRoom = rooms.find(r => r.id === selectedRoomId);
    saveToDb("rooms", targetRoom.id, { ...targetRoom, fixedDate: null });
    triggerToast("일정 확정이 취소되었습니다.");
  };

  const handleAddPersonalSchedule = () => {
    if (!myCalSelectedDate) return triggerToast("날짜를 먼저 선택하세요.");
    const memoText = myCalMemo.trim() || "개인 일정";
    const newScheduleId = Date.now().toString();
    const newSchedule = { id: newScheduleId, userId: currentUser.id, date: myCalSelectedDate, timeType: myCalTimeType, text: memoText };
    
    saveToDb("schedules", newScheduleId, newSchedule);
    setMyCalMemo('');
    triggerToast("내 일정에 추가되었습니다.");
  };
  
  const handleLeaveRoom = (roomId) => {
    const targetRoom = rooms.find(r => r.id === roomId);
    if(targetRoom) {
      const filteredParts = targetRoom.participants.filter(p => p.id !== currentUser.id);
      saveToDb("rooms", targetRoom.id, { ...targetRoom, participants: filteredParts });
      triggerToast("목록에서 삭제되었습니다.");
    }
  };

  const handleDeleteRoomCompletely = (roomId) => {
    deleteFromDb("rooms", roomId);
    triggerToast("모임이 완전히 삭제되었습니다.");
  };

  const handleDevBookingSubmit = (timeType) => {
    if (!devSelectedDate) return triggerToast("예약 일정을 선택하세요.");
    if (devReservations.some(res => res.date === devSelectedDate)) return triggerToast("이 날짜는 이미 선약이 있습니다.");

    const newBookingId = 'dev-' + Date.now();
    const newBooking = { id: newBookingId, date: devSelectedDate, timeType, userId: currentUser.id, nickname: currentUser.name, birth: currentUser.birth };
    
    saveToDb("devReservations", newBookingId, newBooking);
    triggerToast("예약되었습니다.");
  };

  const handleMasterBlockDate = (timeType) => {
    if (!devSelectedDate) return triggerToast("차단할 일자를 선택하세요.");
    if (devReservations.some(res => res.date === devSelectedDate)) return triggerToast("이미 일정이 있습니다.");
    
    const forceBlockId = 'dev-block-' + Date.now();
    const forceBlock = { id: forceBlockId, date: devSelectedDate, timeType, userId: 'master-block', nickname: '개발자 휴무', birth: '4475', memo: devBlockMemo.trim() || '개인 일정' };
    
    saveToDb("devReservations", forceBlockId, forceBlock);
    triggerToast("해당 날짜가 차단되었습니다.");
    setDevBlockMemo('');
  };
  
  const handleDeleteDevReservation = (bookingId) => {
      deleteFromDb("devReservations", bookingId);
      triggerToast("예약/차단이 취소되었습니다.");
  };

  const handleDeletePersonalSchedule = (scheduleId) => {
      deleteFromDb("schedules", scheduleId);
      triggerToast("개인 일정이 취소되었습니다.");
  }

  const handleDeleteMemberCompletely = () => {
    const targetName = prompt("초기화할 멤버의 '이름'을 정확히 입력하세요.");
    if (targetName) {
      const targetUser = usersDatabase.find(u => u.name === targetName);
      if (targetUser) {
        // 1. 사용자 삭제
        deleteFromDb("users", targetUser.id);
        
        // 2. 해당 유저가 만든 방 삭제 또는 참여한 방에서 내보내기
        rooms.forEach(r => {
            if(r.creatorId === targetUser.id) {
                deleteFromDb("rooms", r.id);
            } else if(r.participants.some(p => p.id === targetUser.id)) {
                const filteredParts = r.participants.filter(p => p.id !== targetUser.id);
                saveToDb("rooms", r.id, { ...r, participants: filteredParts });
            }
        });

        // 3. dev예약 삭제
        devReservations.forEach(r => {
            if(r.userId === targetUser.id) deleteFromDb("devReservations", r.id);
        });
        
        // 4. 내일정 삭제
        mySchedules.forEach(s => {
            if(s.userId === targetUser.id) deleteFromDb("schedules", s.id);
        });

        triggerToast(`[${targetName}] 님의 모든 정보가 초기화되었습니다.`);
      } else triggerToast("해당 이름의 멤버를 찾을 수 없습니다.");
    }
  };

  const getMostPromisingDates = (room) => {
    if (!room || !room.participants || room.participants.length === 0) return [];
    const allSelectedDates = [];
    room.participants.forEach(p => {
        if(p.dates && Array.isArray(p.dates)) {
            allSelectedDates.push(...p.dates);
        }
    });
    const uniqueDates = [...new Set(allSelectedDates)];
    const dateCounts = uniqueDates.map(date => ({
        date,
        count: room.participants.filter(p => p.dates && Array.isArray(p.dates) && p.dates.includes(date)).length
    })).filter(dc => dc.count >= 2).sort((a, b) => b.count - a.count);
    
    const maxAttendance = dateCounts[0]?.count || 0;
    return dateCounts.filter(dc => dc.count === maxAttendance);
  };

  const currentMonthDaysMatrix = getDaysInMonthArray(currentYear, currentMonth);
  const currentMonthOffsetGap = getMonthStartOffsetGap(currentYear, currentMonth);
  
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const promisingDates = selectedRoom ? getMostPromisingDates(selectedRoom) : [];
  const myRooms = currentUser ? rooms.filter(r => r.participants && r.participants.some(p => p.id === currentUser.id)) : [];
  
  const myPersonalEvents = mySchedules.filter(s => s.userId === currentUser?.id);
  const myGroupFixedEvents = rooms.filter(r => r.fixedDate && r.participants && r.participants.some(p => p.id === currentUser?.id));
  const myDevEvents = devReservations.filter(r => {
      if (isDeveloper) return r.userId !== 'master-block'; 
      return r.userId === currentUser?.id; 
  });
  const devBlockedEvents = isDeveloper ? devReservations.filter(r => r.userId === 'master-block') : [];

  const blockedByMyPersonalEvents = isDeveloper ? [] : devReservations.filter(r => r.userId !== currentUser?.id && r.userId !== 'master-block').concat(myPersonalEvents);

  return (
    <div className="w-full flex flex-col justify-start flex-grow relative bg-black min-h-screen px-4 pb-10">
      
      {toastMessage && (
        <div className="fixed top-[15%] left-1/2 -translate-x-1/2 z-[100] w-max pointer-events-none px-4">
          <div className="bg-[#111] border border-neutral-600 text-white px-6 py-4 rounded-full shadow-2xl text-[13px] tracking-wider font-bold animate-fade-in text-center break-keep">
            {toastMessage}
          </div>
        </div>
      )}

      {showNoticeModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
          <div className="card-bg p-8 w-full max-w-sm">
            <h3 className="text-[15px] text-white font-bold mb-4 border-b border-neutral-800 pb-4 uppercase font-luxury text-center">BABMOOKZA Guide</h3>
            <div className="text-[12px] text-neutral-400 space-y-4 mb-6 leading-relaxed">
              <p>• <strong className="text-white">방 만들기:</strong> 모임을 만들 때 방장이 점심/저녁을 정하면 참여자는 날짜만 고르면 됩니다!</p>
              <p>• <strong className="text-white">코드로 입장:</strong> 전달받은 코드로 약속에 바로 합류하세요.</p>
              <p>• <strong className="text-white">나의 식사 일정:</strong> 골드/실버 점으로 점심과 저녁 일정을 직관적으로 관리하세요.</p>
            </div>
            
            <div className="mb-6 mt-4">
              <h4 className="text-[11px] text-white font-bold mb-2 tracking-widest uppercase text-center">NOTICE</h4>
              <div className="bg-[#050505] border border-neutral-800 rounded-xl p-4">
                <p className="text-[11px] text-neutral-400 leading-relaxed text-center break-keep">
                  *본 서비스는 <strong>이름과 생일 4자리</strong>만으로 간편하게 로그인됩니다. 설정한 번호를 꼭 기억해주세요!
                </p>
              </div>
            </div>

            <button onClick={() => setShowNoticeModal(false)} className="w-full py-3.5 bg-white text-black rounded-full text-[14px] font-bold transition hover:bg-neutral-200">닫기</button>
          </div>
        </div>
      )}
      
      {confirmDeleteRoomId && (() => {
        const roomToDelete = rooms.find(r => r.id === confirmDeleteRoomId);
        if (!roomToDelete) return null;
        const isCreator = roomToDelete.creatorId === currentUser.id;

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
            <div className="card-bg p-8 w-full max-w-sm text-center">
              <h3 className="text-[16px] text-white font-bold mb-3 tracking-wide">
                {isCreator ? "일정을 완전히 삭제하시겠습니까?" : "목록에서 일정을 지우시겠습니까?"}
              </h3>
              <p className="text-[12px] text-neutral-400 mb-8 leading-relaxed">
                {isCreator ? (
                  <>
                    <span className="text-neutral-200 font-bold">방장 권한으로 일정을 삭제합니다.</span><br/>
                    모든 참여자의 대시보드에서 방이 사라집니다.
                  </>
                ) : (
                  <>
                    이 작업은 내 대시보드 목록에서만 지워지며<br/>방 자체가 삭제되는 것은 아닙니다.
                  </>
                )}
              </p>
              <div className="flex space-x-3">
                <button onClick={() => setConfirmDeleteRoomId(null)} className="flex-1 py-3.5 bg-neutral-900 rounded-full border border-neutral-700 text-white text-[14px] font-bold hover:bg-neutral-800 transition">아니오</button>
                <button onClick={() => { 
                  if (isCreator) {
                    handleDeleteRoomCompletely(confirmDeleteRoomId);
                  } else {
                    handleLeaveRoom(confirmDeleteRoomId); 
                  }
                  setConfirmDeleteRoomId(null); 
                }} className={`flex-1 py-3.5 rounded-full text-[14px] font-bold transition ${isCreator ? 'bg-[#111] border border-neutral-600 text-neutral-300 hover:border-white hover:text-white' : 'bg-white text-black hover:bg-neutral-200'}`}>
                  예, 삭제합니다
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {view === 'login' && (
        <div className="flex flex-col flex-grow animate-fade-in justify-center items-center px-2 min-h-[75vh]">
          <div className="flex flex-col items-center mb-10 w-full">
            <div className="w-32 h-32 rounded-full border border-neutral-800 bg-[#050505] flex items-center justify-center mb-6 overflow-hidden">
               <ForkKnifeSVG />
            </div>
            <h1 className="text-[22px] text-white font-bold tracking-[0.2em] font-luxury uppercase">BABMOOKZA</h1>
            <p className="text-[11px] text-neutral-500 tracking-widest mt-2"></p>
          </div>
          
          <div className="w-full space-y-4 max-w-sm">
            <div className="flex justify-center mb-2">
              <button onClick={() => setShowNoticeModal(true)} className="text-[11px] text-neutral-400 hover:text-white font-bold tracking-widest transition">
                [BOBMOOKZA GUIDE]
              </button>
            </div>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder="이름" className="premium-input"/>
              <input type="password" value={loginBirth} onChange={(e) => setLoginBirth(e.target.value)} placeholder="생일 4자리 (비밀번호)" maxLength={4} className="premium-input"/>
              <button type="submit" className="w-full menu-btn mt-6"><div className="menu-btn-inner">접속하기</div></button>
            </form>
          </div>
        </div>
      )}

      {view === 'dashboard' && currentUser && (
        <div className="flex flex-col flex-grow animate-fade-in justify-start h-full px-2">
          <div className="pb-4 flex justify-between items-end border-b border-neutral-900 mb-6">
            <div>
              <span className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase block mb-1">My Dashboard</span>
              <h2 className="text-[16px] font-bold text-white">{currentUser.name} 님, 환영합니다.</h2>
            </div>
            <button onClick={handleLogout} className="text-[11px] text-neutral-500 hover:text-white underline underline-offset-4 font-bold">로그아웃</button>
          </div>

          <div className="space-y-6">
            <button onClick={() => { setView('my-calendar'); setCurrentYear(2026); setCurrentMonth(6); setMyCalSelectedDate(''); }} className="w-full card-bg p-5 flex items-center justify-between hover:border-neutral-500 transition">
              <div className="text-left">
                <span className="text-[14px] font-bold text-white block mb-1">나의 식사 일정 (My Calendar)</span>
                <span className="text-[11px] text-neutral-500">모임 확정 내역과 개인 일정 통합 관리</span>
              </div>
              <span className="text-neutral-400 font-luxury">&gt;</span>
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setView('create-room'); setSelectedDates([]); setCreatorFirstOpinion(''); }} className="card-bg py-5 px-4 text-center hover:bg-neutral-800 transition">
                <span className="text-[13px] font-bold text-white tracking-wider">새 모임 만들기</span>
              </button>
              <button onClick={() => { setView('join-room'); setJoinCode('BMZ-'); }} className="card-bg py-5 px-4 text-center hover:bg-neutral-800 transition">
                <span className="text-[13px] font-bold text-neutral-300 tracking-wider">코드로 입장</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[12px] font-bold text-neutral-400 tracking-widest uppercase">내가 참여 중인 일정</h3>
                <span className="text-[10px] bg-neutral-800 text-white px-2.5 py-1 rounded-full">{myRooms.length}</span>
              </div>
              {myRooms.length === 0 ? (
                <div className="card-bg p-8 text-center text-[12px] text-neutral-500">아직 참여 중인 일정이 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {myRooms.map(room => (
                    <div key={room.id} onClick={() => { 
                      setSelectedRoomId(room.id); 
                      setInputSelectedDates(room.participants.find(p => p.id === currentUser.id)?.dates || []);
                      setScheduleTab('input'); 
                      setView('view-schedule'); 
                    }} className="card-bg p-5 hover:border-neutral-500 transition cursor-pointer flex justify-between items-center">
                      <div className="flex-1">
                        <span className="text-[10px] text-neutral-500 font-bold block mb-1 font-mono">{room.id}</span>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[14px] font-bold text-white truncate max-w-[180px]">{room.title}</h4>
                          {room.fixedDate && <span className="bg-white text-black text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0">일정 확정됨</span>}
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteRoomId(room.id); }} className="p-2 ml-2 text-neutral-500 hover:text-white transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-900 mt-6">
              <button onClick={() => { setView('dev-lunch-intro'); setCurrentYear(2026); setCurrentMonth(6); setDevSelectedDate(''); }} className="w-full card-bg p-5 flex items-center justify-between hover:border-neutral-500 transition">
                <div className="text-left">
                  <span className="text-[14px] font-bold text-white block mb-1">개발자와의 식사</span>
                  <span className="text-[11px] text-neutral-500">저랑도 먹어주세요.</span>
                </div>
                <span className="text-neutral-400 font-luxury">&gt;</span>
              </button>
            </div>

            {isDeveloper && (
              <div className="card-bg p-6 mt-6 border-neutral-800">
                <h3 className="text-[12px] font-bold text-white tracking-widest uppercase mb-4 text-center">개발자 전용 제어판</h3>
                <div className="space-y-3">
                  <button onClick={handleDeleteMemberCompletely} className="w-full bg-[#111] border border-neutral-700 py-3.5 rounded-full text-neutral-400 text-[12px] font-bold hover:text-white transition">
                    [1] 특정 멤버 완전 초기화
                  </button>
                  <button onClick={() => setShowUserList(!showUserList)} className="w-full bg-[#111] border border-neutral-700 py-3.5 rounded-full text-neutral-400 text-[12px] font-bold hover:text-white transition">
                    [2] 가입 멤버 리스트 조회
                  </button>
                </div>
                {showUserList && (
                  <div className="mt-4 bg-[#050505] p-4 rounded-xl max-h-48 overflow-auto text-[12px] space-y-2 border border-neutral-800">
                    {usersDatabase.map(u => <div key={u.id} className="flex justify-between text-neutral-400"><span className="font-bold text-white">{u.name}</span><span className="font-mono">{u.birth}</span></div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'my-calendar' && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          <div className="pb-4 flex items-center space-x-4 border-b border-neutral-900 mb-6">
            <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[13px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
            <div>
              <h2 className="text-[15px] font-bold text-white uppercase tracking-widest mt-1">나의 식사 일정</h2>
            </div>
          </div>

          <div className="flex-grow flex flex-col space-y-6">
            <div className="card-bg p-6">
              <div className="flex justify-between items-center mb-6">
                <button onClick={() => {setCurrentMonth(c => c===1?12:c-1); if(currentMonth===1) setCurrentYear(y=>y-1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&lt;</button>
                <div className="text-[15px] text-white font-bold tracking-widest">{currentYear}년 {currentMonth}월</div>
                <button onClick={() => {setCurrentMonth(c => c===12?1:c+1); if(currentMonth===12) setCurrentYear(y=>y+1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&gt;</button>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-4 font-bold">
                <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
              </div>

              <div className="grid grid-cols-7 gap-y-3 gap-x-1">
                {Array.from({ length: currentMonthOffsetGap }).map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
                {currentMonthDaysMatrix.map((dateStr, idx) => {
                  const isSelected = myCalSelectedDate === dateStr;
                  
                  const hasLunch = myPersonalEvents.some(e => e.date === dateStr && e.timeType === 'lunch') || 
                                   myGroupFixedEvents.some(r => r.fixedDate === dateStr && r.timeType === 'lunch') || 
                                   myDevEvents.some(r => r.date === dateStr && r.timeType === 'lunch') || 
                                   devBlockedEvents.some(r => r.date === dateStr && r.timeType === 'lunch');
                  
                  const hasDinner = myPersonalEvents.some(e => e.date === dateStr && e.timeType === 'dinner') || 
                                    myGroupFixedEvents.some(r => r.fixedDate === dateStr && r.timeType === 'dinner') || 
                                    myDevEvents.some(r => r.date === dateStr && r.timeType === 'dinner') || 
                                    devBlockedEvents.some(r => r.date === dateStr && r.timeType === 'dinner');
                  
                  const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                  const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                  let btnClass = "w-10 h-10 flex items-center justify-center text-[14px] font-semibold relative transition rounded-full mx-auto ";
                  if (isSelected) {
                    btnClass += "bg-white text-black shadow-lg font-bold";
                  } else if (hasLunch || hasDinner) {
                    btnClass += "border border-white bg-transparent";
                  } else {
                    btnClass += "bg-transparent hover:bg-[#111]";
                  }

                  const textColor = isSelected ? 'text-black' : (hasLunch || hasDinner ? 'text-white font-bold' : (isSunday ? 'text-rose-500/80' : (isSaturday ? 'text-blue-400/80' : 'text-neutral-400')));

                  return (
                    <div key={dateStr} className="relative aspect-square flex flex-col items-center justify-start">
                      <button onClick={() => setMyCalSelectedDate(dateStr)} className={btnClass}>
                        <span className={textColor}>{idx + 1}</span>
                      </button>
                      {(hasLunch || hasDinner) && !isSelected && (
                        <div className="absolute -bottom-1.5 w-full flex justify-center gap-[3px] pointer-events-none">
                          {hasLunch && <span className="w-[5px] h-[5px] gold-micro-dot rounded-full"></span>}
                          {hasDinner && <span className="w-[5px] h-[5px] silver-micro-dot rounded-full"></span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-6 flex justify-end gap-3 text-[11px] text-neutral-500 font-bold px-1">
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 gold-micro-dot rounded-full"></span> 점심 일정</div>
                <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 silver-micro-dot rounded-full"></span> 저녁 일정</div>
              </div>
            </div>

            <div className="card-bg p-6 h-auto">
              <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-3">
                <span className="text-[13px] text-white font-bold tracking-widest">상세 일정 정보</span>
                <span className="text-[14px] text-white font-bold">{myCalSelectedDate && myCalSelectedDate.includes('-') ? `${parseInt(myCalSelectedDate.split('-')[1])}월 ${parseInt(myCalSelectedDate.split('-')[2])}일` : ''}</span>
              </div>

              {myCalSelectedDate ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    {myGroupFixedEvents.filter(r => r.fixedDate === myCalSelectedDate).map((r, i) => (
                      <div key={`g-${i}`} className="p-3 bg-[#111] rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <span className={`text-[10px] border px-2 py-1 rounded-sm mr-2 font-bold ${r.timeType === 'lunch' ? 'text-[#fde047] border-[#fde047]/50' : 'text-white border-neutral-600'}`}>
                            그룹 확정
                          </span>
                          <span className="text-[13px] text-white font-bold">{r.title}</span>
                        </div>
                      </div>
                    ))}
                    {myDevEvents.filter(r => r.date === myCalSelectedDate).map((r, i) => (
                      <div key={`dev-${i}`} className="p-3 bg-[#111] rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <span className={`text-[10px] border px-2 py-1 rounded-sm mr-2 font-bold ${r.timeType === 'lunch' ? 'text-[#fde047] border-[#fde047]/50' : 'text-white border-neutral-600'}`}>
                            개발자 식사
                          </span>
                          <span className="text-[13px] text-white font-bold">{isDeveloper ? `${r.nickname}님 예약` : `예약 완료`}</span>
                        </div>
                      </div>
                    ))}
                    {devBlockedEvents.filter(r => r.date === myCalSelectedDate).map((r, i) => (
                      <div key={`dev-block-${i}`} className="p-3 bg-[#111] rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <span className={`text-[10px] border px-2 py-1 rounded-sm mr-2 font-bold ${r.timeType === 'lunch' ? 'text-[#fde047] border-[#fde047]/50' : 'text-white border-neutral-600'}`}>
                            일정 차단
                          </span>
                          <span className="text-[13px] text-neutral-500 font-bold">{r.memo}</span>
                        </div>
                        <button onClick={() => handleDeleteDevReservation(r.id)} className="text-[11px] text-neutral-400 border border-neutral-700 px-3 py-1 rounded-full font-bold hover:text-white hover:border-neutral-500 transition">해제</button>
                      </div>
                    ))}
                    {myPersonalEvents.filter(e => e.date === myCalSelectedDate).map(e => (
                      <div key={e.id} className="p-3 bg-[#111] rounded-xl border border-neutral-800 flex justify-between items-center">
                        <div>
                          <span className={`text-[10px] px-2 py-1 rounded-sm mr-2 font-bold text-black ${e.timeType === 'lunch' ? 'bg-[#fde047]' : 'bg-white'}`}>
                            개인 일정
                          </span>
                          <span className="text-[13px] text-white font-bold">{e.text}</span>
                        </div>
                        <button onClick={() => handleDeletePersonalSchedule(e.id)} className="text-[11px] text-neutral-400 border border-neutral-700 px-3 py-1 rounded-full font-bold hover:text-white hover:border-neutral-500 transition">취소하기</button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 pt-3 border-t border-neutral-800 mt-2">
                    <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                      <button onClick={()=>setMyCalTimeType('lunch')} className={`p-2 rounded-full transition ${myCalTimeType==='lunch'?'bg-white text-black shadow-md':'text-neutral-500 hover:text-white'}`}>
                        <SunSVG />
                      </button>
                      <button onClick={()=>setMyCalTimeType('dinner')} className={`p-2 rounded-full transition ${myCalTimeType==='dinner'?'bg-white text-black shadow-md':'text-neutral-500 hover:text-white'}`}>
                        <MoonSVG />
                      </button>
                    </div>
                    <input type="text" value={myCalMemo} onChange={e=>setMyCalMemo(e.target.value)} placeholder="개인 일정 내용 (선택)" className="premium-input text-[13px] py-3 flex-1 px-4" />
                    <button onClick={handleAddPersonalSchedule} className="bg-white text-black px-4 py-3 rounded-full font-bold text-[13px] shrink-0 hover:bg-neutral-200 transition">추가</button>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-neutral-500 py-6 text-left">날짜를 선택하세요.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'create-room' && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          <div className="flex items-center space-x-4 pb-4 border-b border-neutral-900 mb-6">
            <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[13px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
            <h2 className="text-[15px] font-bold text-white tracking-widest mt-1">새 일정 만들기</h2>
          </div>
          <form onSubmit={handleCreateRoomSubmit} className="space-y-6 card-bg p-8">
            
            <div className="space-y-3">
              <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold px-1">모임 시간대</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setNewRoomTimeType('lunch')} className={`flex-1 py-3.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-2 transition ${newRoomTimeType === 'lunch' ? 'border-[#fde047] text-[#fde047] bg-[#fde047]/10' : 'border-neutral-800 text-neutral-500 bg-[#111]'}`}>
                  <SunSVG /> 점심 모임
                </button>
                <button type="button" onClick={() => setNewRoomTimeType('dinner')} className={`flex-1 py-3.5 rounded-xl border font-bold text-[13px] flex items-center justify-center gap-2 transition ${newRoomTimeType === 'dinner' ? 'border-white text-white bg-white/10' : 'border-neutral-800 text-neutral-500 bg-[#111]'}`}>
                  <MoonSVG /> 저녁 모임
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold px-1">모임 이름</label>
              <input type="text" value={newRoomTitle} onChange={e => setNewRoomTitle(e.target.value)} placeholder="예: 전략마케팅팀 회식" className="premium-input" />
            </div>
            
            <button type="submit" className="w-full menu-btn mt-6"><div className="menu-btn-inner">캘린더로 이동</div></button>
          </form>
        </div>
      )}

      {view === 'select-dates' && tempRoomData && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          <div className="flex items-center space-x-4 pb-4 border-b border-neutral-900 mb-4">
            <button onClick={() => setView('create-room')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[13px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
            <div className="flex flex-col min-w-0 pt-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${tempRoomData.timeType === 'lunch' ? 'text-[#fde047]' : 'text-white'}`}>{tempRoomData.timeType === 'lunch' ? '점심 식사' : '저녁 식사'}</span>
                <h2 className="text-[14px] font-bold text-white tracking-widest truncate">{tempRoomData.title}</h2>
            </div>
          </div>

          <div className="card-bg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => {setCurrentMonth(c => c===1?12:c-1); if(currentMonth===1) setCurrentYear(y=>y-1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&lt;</button>
              <div className="text-[15px] text-white font-bold tracking-widest">{currentYear}년 {currentMonth}월</div>
              <button onClick={() => {setCurrentMonth(c => c===12?1:c+1); if(currentMonth===12) setCurrentYear(y=>y+1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-4 font-bold">
              <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {Array.from({ length: currentMonthOffsetGap }).map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
              {currentMonthDaysMatrix.map((dateStr, idx) => {
                const isSelected = selectedDates.includes(dateStr);
                const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                let btnClass = "w-10 h-10 flex items-center justify-center text-[14px] transition relative rounded-full mx-auto ";
                btnClass += isSelected ? "bg-white text-black font-bold shadow-lg" : "bg-transparent hover:bg-[#111]";
                
                const textColor = isSelected ? 'text-black' : (isSunday ? 'text-rose-500/80' : (isSaturday ? 'text-blue-400/80' : 'text-neutral-400'));

                return (
                  <div key={dateStr} className="relative aspect-square flex items-center justify-center">
                    <button onClick={() => setSelectedDates(prev => prev.includes(dateStr) ? prev.filter(d=>d!==dateStr) : [...prev, dateStr])} className={btnClass}>
                       <span className={textColor}>{idx + 1}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex flex-col space-y-2 mb-6">
            <label className="text-[11px] uppercase tracking-widest text-neutral-400 font-bold px-1 block">방장의 식사 의견 제시 (선택)</label>
            <input type="text" value={creatorInitialOpinion} onChange={(e) => setCreatorFirstOpinion(e.target.value)} placeholder="원하는 식사 메뉴나 의견을 남겨주세요" className="premium-input w-full" />
          </div>

          <button onClick={handleFinalizeRoom} className="w-full menu-btn mt-auto"><div className="menu-btn-inner">확인</div></button>
        </div>
      )}

      {view === 'join-room' && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          <div className="flex items-center space-x-4 pb-4 border-b border-neutral-900 mb-6">
            <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[13px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
            <h2 className="text-[15px] font-bold text-white tracking-widest mt-1">모임 입장하기</h2>
          </div>
          <form onSubmit={handleJoinRoomSubmit} className="space-y-6 card-bg p-8">
            <div className="space-y-2">
              <label className="text-[11px] text-neutral-400 font-bold block px-1">초대 코드</label>
              <input type="text" value={joinCode} onChange={handleJoinCodeChange} placeholder="BMZ-XXXX" className="premium-input font-mono uppercase" />
            </div>
            <button type="submit" className="w-full menu-btn mt-6"><div className="menu-btn-inner">입장하기</div></button>
          </form>
        </div>
      )}

      {view === 'view-schedule' && selectedRoom && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          
          <div className="flex items-center justify-between pb-4 border-b border-neutral-900 mb-6 mt-2">
            <div className="flex items-center space-x-4 min-w-0 flex-1">
              <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[14px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
              <div className="flex flex-col min-w-0 pt-0.5">
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest mb-0.5">Active Table</span>
                <h3 className="text-[16px] font-bold text-white truncate tracking-widest leading-none">{selectedRoom.title || ''}</h3>
              </div>
            </div>
            <div className="flex flex-col items-end border-l border-neutral-800 pl-4 shrink-0 pt-0.5">
              <span className="text-[9px] text-neutral-500 mb-0.5">초대 코드</span>
              <span className="text-[13px] font-bold text-white font-mono leading-none">{selectedRoom.id || ''}</span>
            </div>
          </div>

          {selectedRoom.fixedDate && (
            <div className="bg-[#1B1B1D] border border-white rounded-xl p-4 mb-6 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block tracking-widest mb-1">방장이 확정한 일정</span>
                <span className="text-[16px] font-bold text-white">{parseInt((selectedRoom.fixedDate || '').split('-')[1] || 0)}월 {parseInt((selectedRoom.fixedDate || '').split('-')[2] || 0)}일</span>
              </div>
              <span className="text-[#e5e5e5]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-neutral-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button onClick={() => { setScheduleTab('input'); setInputSelectedDates((selectedRoom.participants || []).find(p => p.id === currentUser.id)?.dates || []); }} className={`py-4 rounded-[20px] text-[13px] font-bold transition border ${scheduleTab === 'input' ? 'bg-neutral-800 border-neutral-500 text-white' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white'}`}>내 일정 입력</button>
            <button onClick={() => { setScheduleTab('check'); setCheckSelectedDate(''); }} className={`py-4 rounded-[20px] text-[13px] font-bold transition border ${scheduleTab === 'check' ? 'bg-neutral-800 border-neutral-500 text-white' : 'bg-black border-neutral-800 text-neutral-500 hover:text-white'}`}>점심 일정 확인</button>
          </div>

          <div className="card-bg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => {setCurrentMonth(c => c===1?12:c-1); if(currentMonth===1) setCurrentYear(y=>y-1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&lt;</button>
              <div className="text-[15px] text-white font-bold tracking-widest">{currentYear}년 {currentMonth}월</div>
              <button onClick={() => {setCurrentMonth(c => c===12?1:c+1); if(currentMonth===12) setCurrentYear(y=>y+1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-4 font-bold">
              <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {Array.from({ length: currentMonthOffsetGap }).map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
              {currentMonthDaysMatrix.map((dateStr, idx) => {
                const isFocused = scheduleTab === 'input' ? (inputSelectedDates || []).includes(dateStr) : checkSingleDate === dateStr;
                const participantsOnDate = (selectedRoom.participants || []).filter(p => p.dates && Array.isArray(p.dates) && p.dates.includes(dateStr));
                const hasDots = scheduleTab === 'check' && participantsOnDate.length > 0;
                
                const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                let btnClass = "w-10 h-10 flex items-center justify-center text-[14px] font-semibold transition rounded-full mx-auto ";
                if (isFocused) {
                  btnClass += 'bg-white shadow-lg text-black font-bold'; 
                } else if (selectedRoom.fixedDate === dateStr) {
                  btnClass += 'border border-white bg-transparent text-white font-bold'; 
                } else {
                  btnClass += 'bg-transparent hover:bg-[#111]';
                }

                const textColor = isFocused ? 'text-black' : (selectedRoom.fixedDate === dateStr ? 'text-white font-bold' : (isSunday ? 'text-rose-500/80' : (isSaturday ? 'text-blue-400/80' : 'text-neutral-400')));

                return (
                  <div key={dateStr} className="relative aspect-square flex flex-col items-center justify-start pt-1">
                    <button onClick={() => {
                      if (scheduleTab === 'input') setInputSelectedDates(prev => (prev || []).includes(dateStr) ? (prev || []).filter(d => d !== dateStr) : [...(prev || []), dateStr]);
                      else setCheckSelectedDate(dateStr);
                    }} className={btnClass}>
                      <span className={textColor}>
                        {idx + 1}
                      </span>
                    </button>
                    {hasDots && !isFocused && selectedRoom.fixedDate !== dateStr && (
                      <div className="absolute -bottom-1.5 w-full flex justify-center gap-[3px] pointer-events-none">
                          {participantsOnDate.slice(0, 3).map((_, i) => (
                              <span key={i} className={`w-[5px] h-[5px] rounded-full ${selectedRoom.timeType === 'lunch' ? 'gold-micro-dot' : 'silver-micro-dot'}`}></span>
                          ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {scheduleTab === 'input' ? (
            <div className="card-bg p-6 space-y-4">
              <span className="text-[13px] text-white font-bold block mb-2 px-1">내 일정 제출하기</span>
              <input type="text" value={guestOpinion} onChange={e=>setGuestOpinion(e.target.value)} placeholder="원하는 식사 메뉴나 의견을 남겨주세요 (선택)" className="premium-input w-full bg-neutral-900" />
              <button onClick={handleGuestJoinSubmit} className="w-full menu-btn mt-2"><div className="menu-btn-inner text-[15px]">일정 등록하기</div></button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card-bg p-6">
                <h3 className="text-[12px] font-bold text-neutral-400 tracking-widest uppercase mb-3">유력 일정 분석 리포트</h3>
                {promisingDates && promisingDates.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-[12px] text-neutral-300">현재 동료들이 가장 많이 선호하는 유력 일정입니다.</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {promisingDates.map((pd, index) => (
                                <button key={index} onClick={() => setCheckSelectedDate(pd.date)} className="bg-neutral-800 border border-neutral-500 text-white px-3 py-1.5 font-bold rounded-full text-[11px] hover:bg-neutral-700 transition">
                                    {parseInt((pd.date || '').split('-')[1] || 0)}월 {parseInt((pd.date || '').split('-')[2] || 0)}일 ({pd.count}명 선택)
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-[12px] text-neutral-500">아직 2명 이상 일정이 겹치는 날짜가 없습니다.</p>
                )}
              </div>

              <div className="card-bg p-6 h-auto">
                <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-3">
                  <span className="text-[13px] text-neutral-400 font-bold">참석자 현황 상세</span>
                  <span className="text-[14px] text-white font-bold">{checkSingleDate && checkSingleDate.includes('-') ? `${parseInt(checkSingleDate.split('-')[1])}월 ${parseInt(checkSingleDate.split('-')[2])}일` : '-'}</span>
                </div>
                {checkSingleDate ? (
                  <div className="space-y-3">
                    {(selectedRoom.participants || []).filter(p=>p.dates && Array.isArray(p.dates) && p.dates.includes(checkSingleDate)).map((p, i) => (
                       <div key={i} className="flex flex-col bg-[#111] p-4 rounded-xl border border-neutral-800 space-y-1">
                         <span className="text-[13px] font-bold text-white">{p.name} {p.id === currentUser.id && '(나)'}</span>
                         {p.comment !== '없음' && <span className="text-[11px] text-neutral-400">의견: "{p.comment}"</span>}
                       </div>
                    ))}
                    
                    {selectedRoom.creatorId === currentUser.id && (
                      <div className="pt-4 mt-3 border-t border-neutral-800">
                        {selectedRoom.fixedDate === checkSingleDate ? (
                          <button onClick={handleCancelFix} className="w-full py-3.5 rounded-full bg-[#111] border border-neutral-700 text-white text-[13px] font-bold hover:bg-neutral-800 transition">확정 취소하기</button>
                        ) : (
                          <button onClick={() => handleFixSchedule(checkSingleDate)} className="w-full py-3.5 rounded-full bg-white text-black font-bold text-[14px] hover:bg-neutral-200 transition">
                            방장 권한: 이 날짜로 확정
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : <p className="text-[12px] text-neutral-500 text-center py-6">날짜를 터치하세요.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'room-success' && (
        <div className="flex flex-col justify-center items-center flex-grow p-6 animate-fade-in w-full h-full min-h-[70vh] px-2">
          <div className="text-center w-full mb-8">
            <div className="w-16 h-16 rounded-full border border-white flex items-center justify-center mx-auto mb-6">
              <span className="text-white text-3xl font-light">✓</span>
            </div>
            <h2 className="text-[22px] font-bold text-white mb-3">일정 생성 완료</h2>
            <p className="text-[13px] text-neutral-400 leading-relaxed">동료들에게 아래 코드를 공유해 보세요.<br/>이 일정은 내 대시보드에 자동 저장됩니다.</p>
          </div>
          
          <div className="card-bg p-8 text-center space-y-3 w-full max-w-sm mb-6">
            <span className="text-[11px] text-neutral-500 font-bold block uppercase tracking-widest">초대 코드</span>
            <span className="text-[32px] font-bold text-white font-mono block tracking-wider">{createdRoomCode}</span>
          </div>
          
          <div className="w-full space-y-4 max-w-sm">
            <button onClick={() => {
                const dummy = document.createElement('textarea'); document.body.appendChild(dummy);
                dummy.value = `[BABMOOKZA] 식사 일정 초대\n코드: ${createdRoomCode}`;
                dummy.select(); document.execCommand('copy'); document.body.removeChild(dummy);
                triggerToast("클립보드에 복사되었습니다.");
              }} className="w-full menu-btn"><div className="menu-btn-inner text-[15px]">초대 정보 복사하기</div></button>
            
            <div className="flex gap-3 pt-2 w-full">
               <button onClick={() => { 
                 setSelectedRoomId(createdRoomCode); 
                 setInputSelectedDates(selectedDates);
                 setScheduleTab('input'); 
                 setView('view-schedule'); 
               }} className="flex-1 py-4 rounded-full bg-[#111] border border-neutral-800 text-white text-[13px] font-bold hover:bg-neutral-800 transition">내 일정 바로가기</button>
               <button onClick={() => setView('dashboard')} className="flex-1 py-4 rounded-full bg-black border border-neutral-800 text-neutral-400 hover:text-white text-[13px] font-bold transition">대시보드 이동</button>
            </div>
          </div>
        </div>
      )}

      {view === 'dev-lunch-intro' && (
        <div className="flex flex-col flex-grow animate-fade-in px-2">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-900 mb-6 mt-2">
            <div className="flex items-center space-x-4">
              <button onClick={() => setView('dashboard')} className="px-6 py-2.5 bg-[#111] rounded-full border border-neutral-700 text-white text-[14px] font-luxury hover:bg-neutral-800 transition shrink-0">BACK</button>
              <div>
                <h3 className="text-[15px] font-bold text-white font-luxury tracking-widest uppercase mt-1">Developer Match</h3>
                <p className="text-[11px] text-neutral-500 mt-1">개발자와의 식사 예약</p>
              </div>
            </div>
          </div>

          <div className="card-bg p-6 mb-6">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => {setCurrentMonth(c => c===1?12:c-1); if(currentMonth===1) setCurrentYear(y=>y-1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&lt;</button>
              <div className="text-[15px] text-white font-bold tracking-widest">{currentYear}년 {currentMonth}월</div>
              <button onClick={() => {setCurrentMonth(c => c===12?1:c+1); if(currentMonth===12) setCurrentYear(y=>y+1);}} className="text-neutral-500 font-bold p-2 hover:text-white">&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[12px] text-neutral-500 mb-4 font-bold">
              <div className="text-rose-500/80">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-400/80">토</div>
            </div>
            <div className="grid grid-cols-7 gap-y-3 gap-x-1">
              {Array.from({ length: currentMonthOffsetGap }).map((_, i) => <div key={`off7-${i}`} className="aspect-square"></div>)}
              {currentMonthDaysMatrix.map((dateStr, idx) => {
                const matchedBooking = devReservations.find(res => res.date === dateStr);
                const isBlocked = (matchedBooking && matchedBooking.userId === 'master-block') || blockedByMyPersonalEvents.includes(dateStr);
                const isSelected = devSelectedDate === dateStr;
                const isMyBooking = matchedBooking && matchedBooking.userId === currentUser.id;
                const isOthersBooking = matchedBooking && matchedBooking.userId !== currentUser.id && matchedBooking.userId !== 'master-block';

                const isSunday = (idx + currentMonthOffsetGap) % 7 === 0;
                const isSaturday = (idx + currentMonthOffsetGap) % 7 === 6;

                let btnClass = "w-10 h-10 flex items-center justify-center text-[14px] transition relative rounded-full mx-auto ";
                let textColor = "text-neutral-400";

                if (isSelected) {
                  btnClass += "bg-white shadow-lg ";
                  textColor = "text-black font-bold";
                } else if (isBlocked) {
                  if (isDeveloper) {
                    btnClass += "border border-neutral-700 bg-transparent";
                    textColor = "text-neutral-500";
                  } else {
                    btnClass += "border border-neutral-700 bg-[#0a0a0a]";
                    textColor = "text-neutral-600";
                  }
                } else if (isOthersBooking) {
                  if (isDeveloper) {
                    btnClass += "border border-white bg-transparent ";
                    textColor = "text-white font-bold";
                  } else {
                    btnClass += "border border-neutral-700 bg-[#0a0a0a]";
                    textColor = "text-neutral-600";
                  }
                } else if (isMyBooking) {
                  btnClass += "border border-white bg-transparent ";
                  textColor = "text-white font-bold";
                } else {
                  btnClass += "bg-transparent hover:bg-[#111] ";
                  textColor = isSunday ? 'text-rose-500/80' : (isSaturday ? 'text-blue-400/80' : 'text-neutral-400');
                }

                return (
                  <div key={dateStr} className="relative aspect-square flex items-center justify-center">
                    <button onClick={() => setDevSelectedDate(dateStr)} className={btnClass}>
                      <span className={textColor}>{idx + 1}</span>
                    </button>
                    {(isDeveloper || isMyBooking) && matchedBooking && !isSelected && (
                       <div className="absolute -bottom-1.5 w-full flex justify-center gap-[3px] pointer-events-none">
                          <span className={`w-[5px] h-[5px] rounded-full ${matchedBooking.timeType === 'lunch' ? 'gold-micro-dot' : 'silver-micro-dot'}`}></span>
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-bg p-6 h-auto">
            <div className="flex justify-between items-center mb-4 border-b border-neutral-800 pb-3">
              <span className="text-[13px] text-neutral-400 font-bold uppercase tracking-widest">상세 일정 정보</span>
              <span className="text-[14px] text-white font-bold">{devSelectedDate && devSelectedDate.includes('-') ? `${parseInt(devSelectedDate.split('-')[1])}월 ${parseInt(devSelectedDate.split('-')[2])}일` : '선택 대기중'}</span>
            </div>

            {devSelectedDate ? (
              <div className="text-[13px] mt-2">
                {(() => {
                  const booking = devReservations.find(res => res.date === devSelectedDate);
                  const isAutoBlocked = blockedByMyPersonalEvents.includes(devSelectedDate);

                  if (isDeveloper) {
                    if (isAutoBlocked) {
                        return (
                            <div className="space-y-3 pt-2">
                              <p className="text-neutral-400 font-bold text-[14px]">자동 차단된 일정 (마스터)</p>
                              <p className="text-neutral-500">메모: <span className="text-white font-bold">나의 식사 일정과 겹침</span></p>
                              <button onClick={() => { setView('my-calendar'); triggerToast("나의 식사 일정에서 수정하세요."); }} className="w-full py-3.5 rounded-full bg-black border border-neutral-700 text-white font-bold hover:bg-neutral-900 transition mt-2">내 달력에서 확인하기</button>
                            </div>
                        );
                    } else if (!booking) {
                      return (
                        <div className="flex items-center gap-2 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                              <button type="button" onClick={()=>setDevTimeType('lunch')} className={`p-2 rounded-full transition ${devTimeType === 'lunch' ? 'bg-white text-black shadow-md' : 'text-neutral-500 hover:text-white'}`}>
                                <SunSVG />
                              </button>
                              <button type="button" onClick={()=>setDevTimeType('dinner')} className={`p-2 rounded-full transition ${devTimeType === 'dinner' ? 'bg-white text-black shadow-md' : 'text-neutral-500 hover:text-white'}`}>
                                <MoonSVG />
                              </button>
                            </div>
                            <input type="text" value={devBlockMemo} onChange={(e) => setDevBlockMemo(e.target.value)} placeholder="차단 사유 (예: 연차)" className="premium-input text-[13px] py-3 flex-1 px-4" />
                            <button onClick={() => handleMasterBlockDate(devTimeType)} className="bg-neutral-200 text-black px-4 py-3 rounded-full font-bold text-[13px] shrink-0 hover:bg-white transition">블락</button>
                        </div>
                      );
                    } else if (booking.userId === 'master-block') {
                      return (
                        <div className="flex items-center gap-3 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'lunch' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><SunSVG /></div>
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'dinner' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><MoonSVG /></div>
                            </div>
                            <div className="text-[13px] text-neutral-400 font-bold flex-1 px-2">차단됨: {booking.memo}</div>
                            <button onClick={() => handleDeleteDevReservation(booking.id)} className="text-[11px] text-neutral-400 border border-neutral-700 bg-neutral-900 px-3 py-2 rounded-full font-bold hover:bg-neutral-800 hover:text-white transition">해제하기</button>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-3 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'lunch' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><SunSVG /></div>
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'dinner' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><MoonSVG /></div>
                            </div>
                            <div className="text-[13px] text-neutral-300 font-bold flex-1 px-2">예약자: {booking.nickname} 님</div>
                            <button onClick={() => handleDeleteDevReservation(booking.id)} className="text-[11px] text-neutral-400 border border-neutral-700 px-3 py-2 rounded-full font-bold hover:text-white hover:border-neutral-500 transition">강제 취소</button>
                        </div>
                      );
                    }
                  } else {
                    if (isAutoBlocked || (booking && booking.userId !== currentUser.id)) {
                      return (
                        <div className="flex items-center gap-3 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800 opacity-50">
                              <div className="p-2 rounded-full text-neutral-600"><SunSVG /></div>
                              <div className="p-2 rounded-full text-neutral-600"><MoonSVG /></div>
                            </div>
                            <div className="text-[13px] text-neutral-500 font-bold flex-1 px-2">
                              {isAutoBlocked ? "선약이 있습니다." : "다른 분의 선약이 있습니다."}
                            </div>
                        </div>
                      );
                    } else if (!booking) {
                      return (
                        <div className="flex items-center gap-2 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                              <button type="button" onClick={()=>setDevTimeType('lunch')} className={`p-2 rounded-full transition ${devTimeType === 'lunch' ? 'bg-white text-black shadow-md' : 'text-neutral-500 hover:text-white'}`}>
                                <SunSVG />
                              </button>
                              <button type="button" onClick={()=>setDevTimeType('dinner')} className={`p-2 rounded-full transition ${devTimeType === 'dinner' ? 'bg-white text-black shadow-md' : 'text-neutral-500 hover:text-white'}`}>
                                <MoonSVG />
                              </button>
                            </div>
                            <input type="text" value={guestOpinion} disabled placeholder="메모" className="premium-input text-[13px] py-3 flex-1 px-4 opacity-50" />
                            <button onClick={() => handleDevBookingSubmit(devTimeType)} className="bg-white text-black px-4 py-3 rounded-full font-bold text-[13px] shrink-0 hover:bg-neutral-200 transition">추가</button>
                        </div>
                      );
                    } else if (booking.userId === currentUser.id) {
                      return (
                        <div className="flex items-center gap-3 pt-3 border-t border-neutral-800 mt-2">
                            <div className="flex gap-1 shrink-0 bg-[#111] p-1 rounded-full border border-neutral-800">
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'lunch' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><SunSVG /></div>
                              <div className={`p-2 rounded-full transition ${booking.timeType === 'dinner' ? 'bg-white text-black shadow-md' : 'text-neutral-500'}`}><MoonSVG /></div>
                            </div>
                            <div className="text-[13px] text-white font-bold flex-1 px-2">내 예약 관리</div>
                            <button onClick={() => handleDeleteDevReservation(booking.id)} className="text-[11px] text-neutral-400 border border-neutral-700 px-3 py-2 rounded-full font-bold hover:bg-neutral-800 hover:text-white transition">취소하기</button>
                        </div>
                      );
                    }
                  }
                })()}
              </div>
            ) : <p className="text-[12px] text-neutral-500 text-center py-6">날짜를 선택하세요.</p>}
          </div>
        </div>
      )}

    </div>
  );
}