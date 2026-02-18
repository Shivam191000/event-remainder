import java.util.Scanner;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.format.DateTimeFormatter;
import java.util.InputMismatchException;

public class Executer {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        ReminderManager rm = new ReminderManager();
        DateTimeFormatter pattern = DateTimeFormatter.ofPattern("yyyy-MM-dd");

        while (true) {
            System.out.println("\n+------------------------------------+");
            System.out.println("|            Event Menu              |");
            System.out.println("+------------------------------------+");
            System.out.println("|   1. Add Event                     |");
            System.out.println("|   2. Display All Events            |");
            System.out.println("|   3. Show Completed Events         |");
            System.out.println("|   4. Mark Event as Completed       |");
            System.out.println("|   5. Remove Event                  |");
            System.out.println("|   6. Exit                          |");
            System.out.println("+------------------------------------+");

            System.out.print("\nEnter your choice: ");
            int ch = -1;
            try {
                ch = sc.nextInt();
            } catch (InputMismatchException e) {
                System.out.println("Invalid input. Please enter a number.");
                sc.nextLine(); // clear the invalid input
                continue;
            }
            sc.nextLine(); // Consume newline left-over

            switch (ch) {
                case 1:
                    System.out.print("Enter event title: ");
                    String t = sc.nextLine();
                    System.out.print("Enter event description: ");
                    String d = sc.nextLine();
                    LocalDate date2 = null;
                    while (date2 == null) {
                        System.out.print("Enter event date in yyyy-MM-dd format: ");
                        String date = sc.nextLine();
                        try {
                            date2 = LocalDate.parse(date, pattern);
                        } catch (DateTimeParseException e) {
                            System.out.println("Invalid date format. Please try again.");
                        }
                    }
                    rm.addEvent(new Event(t, d, date2));
                    break;

                case 2:
                    rm.viewEvents();
                    break;

                case 3:
                    rm.showCompletedEvents();
                    break;

                case 4:
                    rm.viewEvents();
                    System.out.print("Enter the event number to mark as completed: ");
                    int completeIndex = -1;
                    try {
                        completeIndex = sc.nextInt();
                        sc.nextLine(); // Consume newline
                    } catch (InputMismatchException e) {
                        System.out.println("Invalid input. Please enter a number.");
                        sc.nextLine(); // clear the invalid input
                        continue;
                    }
                    rm.updateEventStatus(completeIndex);
                    break;

                case 5:
                    rm.viewEvents();
                    System.out.print("Enter the event number to remove: ");
                    int removeIndex = -1;
                    try {
                        removeIndex = sc.nextInt();
                        sc.nextLine(); // Consume newline
                    } catch (InputMismatchException e) {
                        System.out.println("Invalid input. Please enter a number.");
                        sc.nextLine(); // clear the invalid input
                        continue;
                    }
                    rm.removeEvent(removeIndex);
                    break;

                case 6:
                    System.out.println("Exiting...");
                    sc.close();
                    return;

                default:
                    System.out.println("Not a valid input! Please choose from the menu.");
                    break;
            }
        }
        } 
    }
