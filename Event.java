import java.time.LocalDate;

/*
 * 1. Title
 * 2. Description
 * 3. Date
 * 4. Status(done/pending)
 */

public class Event{
    private String title;
    private String description;
    private LocalDate date;
    private boolean isCompleted;

    public Event(String title, String description, LocalDate date){
        this.title = title;
        this.description = description;
        this.date = date;
        isCompleted = false;
    }

    public String getTitle(){
        return this.title;
    }
    public String getDescription(){
        return this.description;
    }
    public LocalDate getDate(){
        return this.date;
    }
    public boolean getEventStatus(){
        return isCompleted;
    }

    public void setEventStatus(boolean flag){
        this.isCompleted = flag;
    }
}


