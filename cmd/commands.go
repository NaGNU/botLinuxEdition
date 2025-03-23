package main

import (
	"context"
	"fmt"
	"github.com/go-telegram/bot"
	"github.com/go-telegram/bot/models"
	"strings"
	"strconv"
	"time"
	"regexp"
	"math/rand"
	"os/exec"
)

 
// func startCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
// 	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
// 		ChatID: update.Message.Chat.ID,
// 		Text:   "This is a handler example!",
// 	})
// 	if err != nil {
// 		fmt.Println("Error while sending message:", err)
// 	}
// }

func fetchCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	cmd := exec.Command("cat", "/etc/os-release")

	output, err := cmd.Output()
	if err != nil {
		fmt.Println("Error while reading /etc/os-release:", err)
	}
	
	_, err = b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text:   string(output),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}

func randomQuoteHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
    quotes := []string{
        "«Будь собой, все остальные роли уже заняты.» — Оскар Уайльд",
        "«Не важно, сколько раз ты упал, важно, сколько раз ты поднялся.» — Мэрилин Монро",
        "«Жизнь не в том, чтобы найти себя. Жизнь в том, чтобы создать себя.» — Джордж Бернард Шоу",
        "«Я не хочу, чтобы Linux был простым. Я хочу, чтобы он был мощным.» — Линус Торвальдс",
        "«Linux — это для пользователей, которые могут думать.» — Линус Торвальдс",
        "«Свобода не означает свободу от работы, свобода — это свобода работать без ограничений.» — Ричард Столлман",
        "«Я не считаю, что технологии должны быть закрытыми. Мы должны делиться ими, чтобы люди могли изучать и улучшать их.» — Ричард Столлман",
        "«Linux — это не для тех, кто хочет, чтобы все было просто. Это для тех, кто хочет, чтобы все работало, как нужно.» — Линус Торвальдс",
        "«Linux — юзер френдли, но не долбоеб френдли» — Линус Торвальдс",
        "«Свобода программного обеспечения — это не просто абстракция, это обязательство.» — Ричард Столлман",
        "«Я всегда предпочитал Linux. Он быстрее, безопаснее и просто работает.» — Линус Торвальдс",
        "«Если вы не можете понять код, вы не можете понять, что делает программа.» — Ричард Столлман",
    }
    
    randomQuote := quotes[rand.Intn(len(quotes))]

    _, err := b.SendMessage(ctx, &bot.SendMessageParams{
        ChatID: update.Message.Chat.ID,
        Text:   randomQuote,
    })
    if err != nil {
        fmt.Println("Error while sending message:", err)
    }
}

func daysUntilNewYearHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	now := time.Now()

	nextYear := now.Year() + 1
	newYear := time.Date(nextYear, time.January, 1, 0, 0, 0, 0, time.UTC)

	daysLeft := newYear.Sub(now).Hours() / 24

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text: fmt.Sprintf("До нового года осталось %.0f дней.", daysLeft),
	})
	if err != nil {
        fmt.Println("Error while sending message:", err)
    }
}

func daysUntilSummerHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	now := time.Now()

	summer := time.Date(now.Year(), time.June, 1, 0, 0, 0, 0, time.UTC)
	if now.After(summer) {
		summer = time.Date(now.Year()+1, time.June, 1, 0, 0, 0, 0, time.UTC)
	}

	daysLeft := summer.Sub(now).Hours() / 24

	_, err := b.SendMessage(ctx, &bot.SendMessageParams{
		ChatID: update.Message.Chat.ID,
		Text: fmt.Sprintf("До лета осталось %.0f дней.", daysLeft),
	})
	if err != nil {
		fmt.Println("Error while sending message:", err)
	}
}

func randomFactHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
    facts := []string{
        "Около 60% тела человека состоит из воды.",
        "Пчелы могут распознавать лица.",
        "В Японии есть остров, на котором живут только кролики.",
        "Средняя температура тела человека составляет 37°C.",
        "Собаки могут чувствовать запахи до 100 000 раз лучше, чем люди.",
        "Человеческие глаза могут различать около 10 миллионов цветов.",
        "В 1969 году человек впервые ступил на Луну.",
        "Дельфины спят с одним открытым глазом.",
        "Молния может быть горячее, чем поверхность Солнца.",
        "Самый длинный период, который человек провел без сна, составил 11 дней.",
        "Осьминоги имеют три сердца и голубую кровь.",
        "В Австралии обитает пингвин, который не живет на льду, а на суше.",
        "Самая старая живущая рыба - это акулка, которая может дожить до 400 лет.",
        "В Китае есть деревня, где все жители живут до 100 лет.",
        "Луна отдаляется от Земли на 3,8 см каждый год.",
        "Жирафы могут спать только 30 минут в день.",
        "Жизнь банана длится от 3 до 5 дней после его полного созревания.",
        "В Канаде находится озеро, которое меняет цвет в зависимости от времени года.",
        "Слон — единственное животное, которое не может прыгать.",
        "Альпийские горы продолжают расти на 1 см в год.",
        "Самая длинная река в мире — это река Амазонка.",
        "Зебры имеют уникальные полоски, как отпечатки пальцев у людей.",
        "В мире существует более 2 тысяч языков, которые вымерли.",
        "Медузы не имеют мозга.",
        "Древние египтяне использовали косметику не только для красоты, но и для защиты от солнца.",
        "Человеческие ногти растут быстрее, чем волосы.",
        "Яблоки на 25% состоят из воздуха, поэтому они могут плавать.",
        "Только 2% океанов были исследованы человеком.",
        "На Земле есть место, где не падает дождь в течение десятилетий.",
        "Самое большое живое существо на Земле — гриб в Орегоне.",
        "У страусов самые большие глаза среди наземных животных.",
        "Там, где растут кактусы, осадки могут не выпадать в течение нескольких лет.",
    }
    
    randomFact := facts[rand.Intn(len(facts))]

    _, err := b.SendMessage(ctx, &bot.SendMessageParams{
        ChatID: update.Message.Chat.ID,
        Text:   randomFact,
    })
    if err != nil {
        fmt.Println("Error while sending message:", err)
    }
}

 
func muteCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 3 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /mute <user_id> <duration>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	duration, err := parseDuration(args[2])
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат времени. Используйте, например, '1h' или '30m'.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	muteUser(userId, update.Message.Chat.ID, duration, b, database, ctx)
}

func unmuteCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 2 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /unmute <user_id>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	unmuteUser(userId, update.Message.Chat.ID, b, database, ctx)
}

func isAdmin(userId int) bool {
	for _, admin := range config.Admins {
		if admin == userId {
			return true
		}
	}
	return false
}

func parseDuration(duration string) (time.Duration, error) {
	re := regexp.MustCompile(`^(\d+)(h|m)$`)
	matches := re.FindStringSubmatch(duration)
	if len(matches) != 3 {
		return 0, fmt.Errorf("invalid duration format")
	}

	value, _ := strconv.Atoi(matches[1])
	unit := matches[2]

	if unit == "h" {
		return time.Duration(value) * time.Hour, nil
	} else if unit == "m" {
		return time.Duration(value) * time.Minute, nil
	}

	return 0, fmt.Errorf("unsupported time unit")
}

func warnCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 2 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /warn <user_id>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	warnUser(userId, update.Message.Chat.ID, b, database, ctx)
}

func unwarnCommandHandler(ctx context.Context, b *bot.Bot, update *models.Update) {
	userID := update.Message.From.ID
	if !isAdmin(int(userID)) {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "У вас нет прав для выполнения этой команды.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	args := strings.Fields(update.Message.Text)
	if len(args) < 3 {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат команды. Используйте: /unwarn <user_id> <warn_id>",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	userId, err := strconv.ParseInt(args[1], 10, 64)
	if err != nil {
		_, err := b.SendMessage(ctx, &bot.SendMessageParams{
			ChatID: update.Message.Chat.ID,
			Text:   "Неверный формат ID пользователя.",
		})
		if err != nil {
			fmt.Println("Error while sending message:", err)
		}
		return
	}

	id := args[2]  // Теперь это строка
	idInt64, err := strconv.ParseInt(id, 10, 64)

	unwarnUser(userId, update.Message.Chat.ID, idInt64, b, database, ctx)
}
